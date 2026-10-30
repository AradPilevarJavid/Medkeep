#include "medkeep.hpp"

#include <openssl/evp.h>

#include <algorithm>
#include <array>
#include <cctype>
#include <filesystem>
#include <fstream>
#include <limits>
#include <sstream>
#include <stdexcept>
#include <system_error>
#include <unordered_set>
#include <utility>

namespace medkeep {
namespace {

std::string sha256_hex(const std::string& input) {
    std::array<unsigned char, EVP_MAX_MD_SIZE> digest{};
    unsigned int digest_length = 0;

    const int result = EVP_Digest(input.data(), input.size(), digest.data(),
                                  &digest_length, EVP_sha256(), nullptr);
    if (result != 1 || digest_length != 32) {
        throw std::runtime_error("OpenSSL could not calculate SHA-256.");
    }

    static constexpr char hex_digits[] = "0123456789abcdef";
    std::string output;
    output.reserve(digest_length * 2);
    for (unsigned int i = 0; i < digest_length; ++i) {
        output.push_back(hex_digits[digest[i] >> 4U]);
        output.push_back(hex_digits[digest[i] & 0x0FU]);
    }
    return output;
}

std::string calculate_record_hash(const std::string& previous_digest,
                                  std::uint64_t id,
                                  const std::string& content) {
    std::string payload = "MedKeep/SHA256/v1";
    payload.push_back('\0');
    payload.append(previous_digest);

    for (int shift = 56; shift >= 0; shift -= 8) {
        payload.push_back(static_cast<char>((id >> shift) & 0xFFU));
    }

    const auto content_size = static_cast<std::uint64_t>(content.size());
    for (int shift = 56; shift >= 0; shift -= 8) {
        payload.push_back(static_cast<char>((content_size >> shift) & 0xFFU));
    }

    payload.append(content);
    return sha256_hex(payload);
}

std::string hex_encode(const std::string& input) {
    static constexpr char hex_digits[] = "0123456789abcdef";
    std::string output;
    output.reserve(input.size() * 2);

    for (const unsigned char byte : input) {
        output.push_back(hex_digits[byte >> 4U]);
        output.push_back(hex_digits[byte & 0x0FU]);
    }
    return output;
}

int hex_value(char character) {
    if (character >= '0' && character <= '9') {
        return character - '0';
    }
    if (character >= 'a' && character <= 'f') {
        return character - 'a' + 10;
    }
    if (character >= 'A' && character <= 'F') {
        return character - 'A' + 10;
    }
    return -1;
}

std::string hex_decode(const std::string& input) {
    if (input.size() % 2 != 0) {
        throw std::runtime_error("Invalid hexadecimal content in archive.");
    }

    std::string output;
    output.reserve(input.size() / 2);
    for (std::size_t i = 0; i < input.size(); i += 2) {
        const int high = hex_value(input[i]);
        const int low = hex_value(input[i + 1]);
        if (high < 0 || low < 0) {
            throw std::runtime_error("Invalid hexadecimal content in archive.");
        }
        output.push_back(static_cast<char>((high << 4) | low));
    }
    return output;
}

std::string normalize_digest(const std::string& digest) {
    if (digest.size() != 64) {
        throw std::runtime_error("A stored SHA-256 digest must contain 64 hex characters.");
    }

    std::string normalized = digest;
    for (char& character : normalized) {
        if (hex_value(character) < 0) {
            throw std::runtime_error("A stored digest contains a non-hexadecimal character.");
        }
        character = static_cast<char>(std::tolower(static_cast<unsigned char>(character)));
    }
    return normalized;
}

std::vector<std::string> split_tabs(const std::string& line) {
    std::vector<std::string> fields;
    std::size_t start = 0;

    while (true) {
        const std::size_t delimiter = line.find('\t', start);
        if (delimiter == std::string::npos) {
            fields.push_back(line.substr(start));
            break;
        }
        fields.push_back(line.substr(start, delimiter - start));
        start = delimiter + 1;
    }
    return fields;
}

std::uint64_t parse_id(const std::string& value) {
    if (value.empty()) {
        throw std::runtime_error("An archive entry has an empty ID.");
    }
    for (const char character : value) {
        if (character < '0' || character > '9') {
            throw std::runtime_error("An archive entry has an invalid ID.");
        }
    }

    std::size_t parsed = 0;
    unsigned long long id = 0;
    try {
        id = std::stoull(value, &parsed);
    } catch (const std::exception&) {
        throw std::runtime_error("An archive entry has an invalid ID.");
    }
    if (parsed != value.size() || id == 0) {
        throw std::runtime_error("An archive entry has an invalid ID.");
    }
    return static_cast<std::uint64_t>(id);
}

}  // namespace

RequestQueue::~RequestQueue() {
    clear();
}

void RequestQueue::clear() noexcept {
    while (head_) {
        std::unique_ptr<QueueNode> next = std::move(head_->next);
        head_ = std::move(next);
    }
    tail_ = nullptr;
    size_ = 0;
}

RequestQueue::RequestQueue(RequestQueue&& other) noexcept
    : head_(std::move(other.head_)), tail_(other.tail_), size_(other.size_) {
    other.tail_ = nullptr;
    other.size_ = 0;
}

RequestQueue& RequestQueue::operator=(RequestQueue&& other) noexcept {
    if (this != &other) {
        clear();
        head_ = std::move(other.head_);
        tail_ = other.tail_;
        size_ = other.size_;

        other.tail_ = nullptr;
        other.size_ = 0;
    }
    return *this;
}

void RequestQueue::enqueue(Request request) {
    auto node = std::make_unique<QueueNode>(std::move(request));
    QueueNode* const new_tail = node.get();

    if (tail_ == nullptr) {
        head_ = std::move(node);
    } else {
        tail_->next = std::move(node);
    }

    tail_ = new_tail;
    ++size_;
}

std::optional<Request> RequestQueue::dequeue() {
    if (!head_) {
        return std::nullopt;
    }

    std::unique_ptr<QueueNode> first = std::move(head_);
    head_ = std::move(first->next);
    --size_;

    if (!head_) {
        tail_ = nullptr;
    }

    return std::move(first->request);
}

const Request* RequestQueue::front() const noexcept {
    return head_ ? &head_->request : nullptr;
}

bool RequestQueue::empty() const noexcept {
    return size_ == 0;
}

std::size_t RequestQueue::size() const noexcept {
    return size_;
}

std::vector<Request> RequestQueue::to_vector() const {
    std::vector<Request> result;
    result.reserve(size_);

    const QueueNode* current = head_.get();
    while (current != nullptr) {
        result.push_back(current->request);
        current = current->next.get();
    }
    return result;
}

LogChain::~LogChain() {
    clear();
}

LogChain::LogChain(LogChain&& other) noexcept
    : head_(std::move(other.head_)), record_count_(other.record_count_) {
    other.record_count_ = 0;
}

LogChain& LogChain::operator=(LogChain&& other) noexcept {
    if (this != &other) {
        clear();
        head_ = std::move(other.head_);
        record_count_ = other.record_count_;
        other.record_count_ = 0;
    }
    return *this;
}

void LogChain::clear() noexcept {
    while (head_) {
        std::unique_ptr<Node> previous = std::move(head_->previous);
        head_ = std::move(previous);
    }
    record_count_ = 0;
}

std::string LogChain::latest_digest() const {
    if (!head_) {
        return {};
    }
    if (head_->kind != NodeKind::Hash) {
        throw std::logic_error("The chain head is not a hash node.");
    }
    return head_->value;
}

void LogChain::append(std::uint64_t id, const std::string& content) {
    const std::string digest = calculate_record_hash(latest_digest(), id, content);
    append_loaded(id, content, digest);
}

void LogChain::append_loaded(std::uint64_t id, const std::string& content,
                             const std::string& digest) {
    auto record_node = std::make_unique<Node>(NodeKind::Record, id, content);
    auto hash_node = std::make_unique<Node>(NodeKind::Hash, id, digest);

    record_node->previous = std::move(head_);
    hash_node->previous = std::move(record_node);
    head_ = std::move(hash_node);
    ++record_count_;
}

std::vector<Record> LogChain::verify_and_extract(std::string& error) const {
    error.clear();
    std::vector<Record> newest_first;
    newest_first.reserve(record_count_);

    const Node* cursor = head_.get();
    std::uint64_t newer_record_id = 0;
    while (cursor != nullptr) {
        if (cursor->kind != NodeKind::Hash) {
            error = "The linked-list structure is invalid: expected a hash node.";
            return {};
        }

        const Node* record_node = cursor->previous.get();
        if (record_node == nullptr || record_node->kind != NodeKind::Record) {
            error = "The linked-list structure is invalid: a hash node has no record node.";
            return {};
        }

        if (record_node->id != cursor->id) {
            error = "The record ID and its hash-node ID do not match.";
            return {};
        }
        if (newer_record_id != 0 && record_node->id >= newer_record_id) {
            error = "Record IDs are not in strictly increasing insertion order.";
            return {};
        }
        newer_record_id = record_node->id;

        const Node* previous_hash_node = record_node->previous.get();
        std::string previous_digest;
        if (previous_hash_node != nullptr) {
            if (previous_hash_node->kind != NodeKind::Hash) {
                error = "The linked-list structure is invalid: expected the previous hash node.";
                return {};
            }
            previous_digest = previous_hash_node->value;
        }

        const std::string calculated = calculate_record_hash(
            previous_digest, record_node->id, record_node->value);
        if (calculated != cursor->value) {
            error = "Integrity verification failed at record " +
                    std::to_string(record_node->id) + ".";
            return {};
        }

        newest_first.push_back(
            Record{record_node->id, record_node->value, cursor->value});
        cursor = previous_hash_node;
    }

    if (newest_first.size() != record_count_) {
        error = "The stored record count does not match the linked-list contents.";
        return {};
    }

    std::reverse(newest_first.begin(), newest_first.end());
    return newest_first;
}

std::vector<Record> LogChain::records_chronological() const {
    std::vector<Record> newest_first;
    newest_first.reserve(record_count_);

    const Node* cursor = head_.get();
    while (cursor != nullptr) {
        if (cursor->kind != NodeKind::Hash || cursor->previous == nullptr ||
            cursor->previous->kind != NodeKind::Record) {
            throw std::runtime_error("Cannot save a malformed linked-list structure.");
        }

        const Node* record_node = cursor->previous.get();
        newest_first.push_back(Record{record_node->id, record_node->value, cursor->value});
        cursor = record_node->previous.get();
    }

    if (newest_first.size() != record_count_) {
        throw std::runtime_error("Cannot save: the stored record count is inconsistent.");
    }

    std::reverse(newest_first.begin(), newest_first.end());
    return newest_first;
}

std::size_t LogChain::size() const noexcept {
    return record_count_;
}

std::uint64_t MedKeep::enqueue_request(std::string content) {
    if (next_id_ == std::numeric_limits<std::uint64_t>::max()) {
        throw std::overflow_error("The request ID limit has been reached.");
    }

    const std::uint64_t id = next_id_;
    requests_.enqueue(Request{id, std::move(content)});
    ++next_id_;
    return id;
}

bool MedKeep::process_next() {
    const Request* request = requests_.front();
    if (request == nullptr) {
        return false;
    }

    chain_.append(request->id, request->content);
    const std::optional<Request> removed = requests_.dequeue();
    return removed.has_value();
}

std::size_t MedKeep::process_all() {
    std::size_t processed = 0;
    while (process_next()) {
        ++processed;
    }
    return processed;
}

std::vector<Record> MedKeep::verify_and_extract(std::string& error) const {
    return chain_.verify_and_extract(error);
}

std::vector<Request> MedKeep::pending_requests() const {
    return requests_.to_vector();
}

std::size_t MedKeep::record_count() const noexcept {
    return chain_.size();
}

std::size_t MedKeep::pending_count() const noexcept {
    return requests_.size();
}

void MedKeep::save(const std::string& path) const {
    const std::vector<Record> records = chain_.records_chronological();
    const std::vector<Request> pending = requests_.to_vector();

    std::ostringstream contents;
    contents << "MEDKEEP\t1\n";

    for (const Record& record : records) {
        contents << "C\t" << record.id << '\t' << record.digest << '\t'
                 << hex_encode(record.content) << '\n';
    }

    for (const Request& request : pending) {
        contents << "Q\t" << request.id << '\t' << hex_encode(request.content) << '\n';
    }

    const std::filesystem::path destination(path);
    const std::filesystem::path temporary(path + ".tmp");

    {
        std::ofstream output(temporary, std::ios::binary | std::ios::trunc);
        if (!output) {
            throw std::runtime_error("Could not open the archive file for writing: " + path);
        }
        output << contents.str();
        output.flush();
        if (!output) {
            throw std::runtime_error("Could not write the archive file: " + path);
        }
    }

    std::error_code error;
    std::filesystem::rename(temporary, destination, error);
    if (error) {
        std::error_code cleanup_error;
        std::filesystem::remove(temporary, cleanup_error);
        throw std::runtime_error("Could not replace the archive file: " + error.message());
    }
}

MedKeep MedKeep::load(const std::string& path) {
    std::ifstream input(path, std::ios::binary);
    if (!input) {
        throw std::runtime_error("Could not open the archive file: " + path);
    }

    std::string line;
    if (!std::getline(input, line)) {
        throw std::runtime_error("The archive file is empty.");
    }
    if (!line.empty() && line.back() == '\r') {
        line.pop_back();
    }
    if (line != "MEDKEEP\t1") {
        throw std::runtime_error("Unsupported or invalid MedKeep archive header.");
    }

    std::vector<Record> records;
    std::vector<Request> pending;
    std::unordered_set<std::uint64_t> seen_ids;
    std::uint64_t previous_id = 0;
    bool saw_pending_request = false;

    while (std::getline(input, line)) {
        if (!line.empty() && line.back() == '\r') {
            line.pop_back();
        }
        if (line.empty()) {
            continue;
        }

        const std::vector<std::string> fields = split_tabs(line);
        if (fields.empty()) {
            throw std::runtime_error("Invalid archive entry.");
        }

        if (fields[0] == "C") {
            if (saw_pending_request) {
                throw std::runtime_error("Committed records cannot appear after pending requests.");
            }
            if (fields.size() != 4) {
                throw std::runtime_error("A committed-record entry has an invalid format.");
            }
            const std::uint64_t id = parse_id(fields[1]);
            if (id <= previous_id || !seen_ids.insert(id).second) {
                throw std::runtime_error("Archive request IDs must be unique and increasing.");
            }
            previous_id = id;
            records.push_back(Record{id, hex_decode(fields[3]), normalize_digest(fields[2])});
        } else if (fields[0] == "Q") {
            saw_pending_request = true;
            if (fields.size() != 3) {
                throw std::runtime_error("A pending-request entry has an invalid format.");
            }
            const std::uint64_t id = parse_id(fields[1]);
            if (id <= previous_id || !seen_ids.insert(id).second) {
                throw std::runtime_error("Archive request IDs must be unique and increasing.");
            }
            previous_id = id;
            pending.push_back(Request{id, hex_decode(fields[2])});
        } else {
            throw std::runtime_error("Unknown archive entry type: " + fields[0]);
        }
    }

    if (input.bad()) {
        throw std::runtime_error("An error occurred while reading the archive file.");
    }
    if (previous_id == std::numeric_limits<std::uint64_t>::max()) {
        throw std::runtime_error("The archive has exhausted the request ID range.");
    }

    MedKeep application;
    for (const Record& record : records) {
        application.chain_.append_loaded(record.id, record.content, record.digest);
    }
    for (Request& request : pending) {
        application.requests_.enqueue(std::move(request));
    }
    application.next_id_ = previous_id + 1;
    return application;
}

}  // namespace medkeep
