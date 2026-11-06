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
}  // namespace medkeep
