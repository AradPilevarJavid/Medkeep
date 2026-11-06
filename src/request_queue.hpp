#ifndef MEDKEEP_REQUEST_QUEUE_HPP
#define MEDKEEP_REQUEST_QUEUE_HPP

#include <cstddef>
#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace medkeep {

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

}  // namespace medkeep

#endif
