#ifndef MEDKEEP_HPP
#define MEDKEEP_HPP

#include <cstddef>
#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace medkeep {

struct Record {
    std::uint64_t id{};
    std::string content;
    std::string digest;
};

struct Request {
    std::uint64_t id{};
    std::string content;
};

class RequestQueue final {
public:
    RequestQueue() = default;
    ~RequestQueue();

    RequestQueue(const RequestQueue&) = delete;
    RequestQueue& operator=(const RequestQueue&) = delete;

    RequestQueue(RequestQueue&& other) noexcept;
    RequestQueue& operator=(RequestQueue&& other) noexcept;

    void enqueue(Request request);
    std::optional<Request> dequeue();
    [[nodiscard]] const Request* front() const noexcept;
    [[nodiscard]] bool empty() const noexcept;
    [[nodiscard]] std::size_t size() const noexcept;
    [[nodiscard]] std::vector<Request> to_vector() const;

private:
    struct QueueNode {
        explicit QueueNode(Request value) : request(std::move(value)) {}

        Request request;
        std::unique_ptr<QueueNode> next;
    };

    std::unique_ptr<QueueNode> head_;
    QueueNode* tail_ = nullptr;
    std::size_t size_ = 0;

    void clear() noexcept;
};

class LogChain final {
public:
    LogChain() = default;
    ~LogChain();
    LogChain(const LogChain&) = delete;
    LogChain& operator=(const LogChain&) = delete;
    LogChain(LogChain&& other) noexcept;
    LogChain& operator=(LogChain&& other) noexcept;

    void append(std::uint64_t id, const std::string& content);
    [[nodiscard]] std::vector<Record> verify_and_extract(std::string& error) const;
    [[nodiscard]] std::vector<Record> records_chronological() const;
    [[nodiscard]] std::size_t size() const noexcept;

private:
    enum class NodeKind {
        Record,
        Hash
    };

    struct Node {
        Node(NodeKind node_kind, std::uint64_t node_id, std::string node_value)
            : kind(node_kind), id(node_id), value(std::move(node_value)) {}

        NodeKind kind;
        std::uint64_t id;
        std::string value;
        std::unique_ptr<Node> previous;
    };

    void append_loaded(std::uint64_t id, const std::string& content,
                       const std::string& digest);
    [[nodiscard]] std::string latest_digest() const;
    void clear() noexcept;

    std::unique_ptr<Node> head_;
    std::size_t record_count_ = 0;

    friend class MedKeep;
};

class MedKeep final {
public:
    MedKeep() = default;
    MedKeep(const MedKeep&) = delete;
    MedKeep& operator=(const MedKeep&) = delete;
    MedKeep(MedKeep&&) noexcept = default;
    MedKeep& operator=(MedKeep&&) noexcept = default;

    [[nodiscard]] std::uint64_t enqueue_request(std::string content);
    [[nodiscard]] bool process_next();
    [[nodiscard]] std::size_t process_all();

    [[nodiscard]] std::vector<Record> verify_and_extract(std::string& error) const;
    [[nodiscard]] std::vector<Request> pending_requests() const;

    [[nodiscard]] std::size_t record_count() const noexcept;
    [[nodiscard]] std::size_t pending_count() const noexcept;

    void save(const std::string& path) const;
    [[nodiscard]] static MedKeep load(const std::string& path);

private:
    LogChain chain_;
    RequestQueue requests_;
    std::uint64_t next_id_ = 1;
};

}  // namespace medkeep

#endif  // MEDKEEP_HPP
