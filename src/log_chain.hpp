#ifndef MEDKEEP_LOG_CHAIN_HPP
#define MEDKEEP_LOG_CHAIN_HPP

#include <cstddef>
#include <cstdint>
#include <memory>
#include <string>
#include <utility>
#include <vector>

namespace medkeep {

struct Record {
    std::uint64_t id{};
    std::string content;
    std::string digest;
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
    enum class NodeKind { Record, Hash };
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

}  // namespace medkeep

#endif
