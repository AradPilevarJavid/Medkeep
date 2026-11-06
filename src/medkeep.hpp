#ifndef MEDKEEP_HPP
#define MEDKEEP_HPP

#include <cstdint>
#include <string>
#include <vector>

#include "log_chain.hpp"
#include "request_queue.hpp"

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

    [[nodiscard]] std::vector<Record> verify_and_extract(std::string& error) const;

    void save(const std::string& path) const;
    [[nodiscard]] static MedKeep load(const std::string& path);

private:
    LogChain chain_;
    RequestQueue requests_;
    std::uint64_t next_id_ = 1;
};

}  // namespace medkeep

#endif  // MEDKEEP_HPP
