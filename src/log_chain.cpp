#include "log_chain.hpp"

#include <algorithm>
#include <stdexcept>

namespace medkeep {
namespace {

std::string calculate_record_hash(const std::string& previous_digest,
                                  std::uint64_t id, const std::string& content) {
    constexpr std::uint64_t offset_basis = 14695981039346656037ULL;
    constexpr std::uint64_t prime = 1099511628211ULL;
    constexpr char domain[] = "MedKeep/FNV1a64/v1";
    static constexpr char hex_digits[] = "0123456789abcdef";

    std::uint64_t hash = offset_basis;
    const auto add_byte = [&hash](unsigned char byte) {
        hash ^= byte;
        hash *= prime;
    };
    for (const unsigned char byte : domain) add_byte(byte);
    for (const unsigned char byte : previous_digest) add_byte(byte);
    for (int shift = 56; shift >= 0; shift -= 8) {
        add_byte(static_cast<unsigned char>((id >> shift) & 0xFFU));
    }
    const auto content_size = static_cast<std::uint64_t>(content.size());
    for (int shift = 56; shift >= 0; shift -= 8) {
        add_byte(static_cast<unsigned char>((content_size >> shift) & 0xFFU));
    }
    for (const unsigned char byte : content) add_byte(byte);

    char output[16];
    for (int i = 15; i >= 0; --i) {
        output[i] = hex_digits[hash & 0x0FU];
        hash >>= 4U;
    }
    return std::string(output, sizeof(output));
}

}  // namespace

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

}  // namespace medkeep
