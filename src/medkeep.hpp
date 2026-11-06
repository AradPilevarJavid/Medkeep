#ifndef MEDKEEP_HPP
#define MEDKEEP_HPP

#include <cstddef>
#include <cstdint>
#include "log_chain.hpp"
#include "request_queue.hpp"

#include <string>

namespace medkeep {

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
