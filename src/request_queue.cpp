#include "request_queue.hpp"

namespace medkeep {
RequestQueue::~RequestQueue() {
    clear();
}

void RequestQueue::clear() noexcept {
    while (head_) {
        std::unique_ptr<QueueNode> next = std::move(head_->next);
        head_ = std::move(next);
    }
    tail_ = nullptr;
}

RequestQueue::RequestQueue(RequestQueue&& other) noexcept
    : head_(std::move(other.head_)), tail_(other.tail_) {
    other.tail_ = nullptr;
}

RequestQueue& RequestQueue::operator=(RequestQueue&& other) noexcept {
    if (this != &other) {
        clear();
        head_ = std::move(other.head_);
        tail_ = other.tail_;

        other.tail_ = nullptr;
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
}

std::optional<Request> RequestQueue::dequeue() {
    if (!head_) {
        return std::nullopt;
    }

    std::unique_ptr<QueueNode> first = std::move(head_);
    head_ = std::move(first->next);
    if (!head_) {
        tail_ = nullptr;
    }

    return std::move(first->request);
}

const Request* RequestQueue::front() const noexcept {
    return head_ ? &head_->request : nullptr;
}

bool RequestQueue::empty() const noexcept {
    return head_ == nullptr;
}

std::vector<Request> RequestQueue::to_vector() const {
    std::vector<Request> result;

    const QueueNode* current = head_.get();
    while (current != nullptr) {
        result.push_back(current->request);
        current = current->next.get();
    }
    return result;
}
}  // namespace medkeep
