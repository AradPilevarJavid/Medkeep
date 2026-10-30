#include "medkeep.hpp"

#include <filesystem>
#include <fstream>
#include <functional>
#include <iostream>
#include <iterator>
#include <stdexcept>
#include <string>
#include <vector>

namespace {

void require(bool condition) {
    if (!condition) {
        throw std::runtime_error("A MedKeep test assertion failed.");
    }
}

std::filesystem::path temporary_path(const std::string& name) {
    return std::filesystem::temp_directory_path() /
           ("medkeep_test_" + std::to_string(
                static_cast<unsigned long long>(std::hash<std::string>{}(name))) + ".db");
}

void test_empty_chain() {
    medkeep::MedKeep application;
    std::string error;
    const auto records = application.verify_and_extract(error);
    require(error.empty());
    require(records.empty());
    require(application.record_count() == 0);
}

void test_fifo_and_hash_chain() {
    medkeep::MedKeep application;
    require(application.enqueue_request("first patient") == 1);
    require(application.enqueue_request("second patient") == 2);
    require(application.enqueue_request("third patient") == 3);
    require(application.pending_count() == 3);

    require(application.process_next());
    require(application.process_next());
    require(application.process_next());
    require(!application.process_next());
    require(application.pending_count() == 0);

    std::string error;
    const auto records = application.verify_and_extract(error);
    require(error.empty());
    require(records.size() == 3);
    require(records[0].id == 1 && records[0].content == "first patient");
    require(records[1].id == 2 && records[1].content == "second patient");
    require(records[2].id == 3 && records[2].content == "third patient");
    require(records[0].digest.size() == 64);
}

void test_queue_preserves_fifo_order() {
    medkeep::MedKeep application;
    for (int i = 0; i < 150; ++i) {
        const auto id = application.enqueue_request("record-" + std::to_string(i));
        require(id == static_cast<std::uint64_t>(i + 1));
    }

    const auto pending = application.pending_requests();
    require(pending.size() == 150);
    for (int i = 0; i < 150; ++i) {
        require(pending[static_cast<std::size_t>(i)].id ==
               static_cast<std::uint64_t>(i + 1));
        require(pending[static_cast<std::size_t>(i)].content ==
               "record-" + std::to_string(i));
    }
}

void test_persistence_includes_pending_requests() {
    const auto path = temporary_path("persistence");
    std::filesystem::remove(path);
    std::filesystem::remove(path.string() + ".tmp");

    medkeep::MedKeep application;
    require(application.enqueue_request("committed record") == 1);
    require(application.process_next());
    require(application.enqueue_request("pending one") == 2);
    require(application.enqueue_request("pending two") == 3);
    application.save(path.string());

    medkeep::MedKeep loaded = medkeep::MedKeep::load(path.string());
    require(loaded.record_count() == 1);
    require(loaded.pending_count() == 2);

    const auto pending = loaded.pending_requests();
    require(pending[0].content == "pending one");
    require(pending[1].content == "pending two");

    require(loaded.process_all() == 2);
    std::string error;
    const auto records = loaded.verify_and_extract(error);
    require(error.empty());
    require(records.size() == 3);
    require(records[0].content == "committed record");
    require(records[1].content == "pending one");
    require(records[2].content == "pending two");

    std::filesystem::remove(path);
}

void test_tampering_is_detected() {
    const auto path = temporary_path("tampering");
    std::filesystem::remove(path);
    std::filesystem::remove(path.string() + ".tmp");

    medkeep::MedKeep application;
    require(application.enqueue_request("original medical record") == 1);
    require(application.process_next());
    application.save(path.string());

    std::ifstream input(path, std::ios::binary);
    require(input.good());
    std::string archive((std::istreambuf_iterator<char>(input)),
                        std::istreambuf_iterator<char>());
    input.close();

    const std::size_t row_start = archive.find('\n') + 1;
    require(row_start != 0 && row_start < archive.size());
    const std::size_t first_tab = archive.find('\t', row_start);
    const std::size_t second_tab = archive.find('\t', first_tab + 1);
    const std::size_t third_tab = archive.find('\t', second_tab + 1);
    require(first_tab != std::string::npos);
    require(second_tab != std::string::npos);
    require(third_tab != std::string::npos);
    const std::size_t content_start = third_tab + 1;
    require(content_start < archive.size());
    archive[content_start] = archive[content_start] == '0' ? '1' : '0';

    std::ofstream output(path, std::ios::binary | std::ios::trunc);
    output << archive;
    output.close();

    medkeep::MedKeep loaded = medkeep::MedKeep::load(path.string());
    std::string error;
    const auto records = loaded.verify_and_extract(error);
    require(records.empty());
    require(error.find("Integrity verification failed") != std::string::npos);

    std::filesystem::remove(path);
}

void test_multiline_utf8_and_empty_content_persist() {
    const auto path = temporary_path("multiline");
    std::filesystem::remove(path);
    std::filesystem::remove(path.string() + ".tmp");

    medkeep::MedKeep application;
    const std::string multilingual = "بیمار\tاول\nMedication: café";
    require(application.enqueue_request(multilingual) == 1);
    require(application.enqueue_request("") == 2);
    require(application.process_all() == 2);
    application.save(path.string());

    medkeep::MedKeep loaded = medkeep::MedKeep::load(path.string());
    std::string error;
    const auto records = loaded.verify_and_extract(error);
    require(error.empty());
    require(records.size() == 2);
    require(records[0].content == multilingual);
    require(records[1].content.empty());

    std::filesystem::remove(path);
}

void test_earlier_hash_tampering_breaks_later_link() {
    const auto path = temporary_path("hash_domino");
    std::filesystem::remove(path);
    std::filesystem::remove(path.string() + ".tmp");

    medkeep::MedKeep application;
    require(application.enqueue_request("record one") == 1);
    require(application.process_next());
    require(application.enqueue_request("record two") == 2);
    require(application.process_next());
    application.save(path.string());

    std::ifstream input(path, std::ios::binary);
    require(input.good());
    std::string archive((std::istreambuf_iterator<char>(input)),
                        std::istreambuf_iterator<char>());
    input.close();

    const std::size_t first_row = archive.find('\n') + 1;
    require(first_row != 0 && first_row < archive.size());
    const std::size_t first_tab = archive.find('\t', first_row);
    const std::size_t second_tab = archive.find('\t', first_tab + 1);
    require(first_tab != std::string::npos);
    require(second_tab != std::string::npos);
    const std::size_t digest_start = second_tab + 1;
    require(digest_start < archive.size());
    archive[digest_start] = archive[digest_start] == '0' ? '1' : '0';

    std::ofstream output(path, std::ios::binary | std::ios::trunc);
    output << archive;
    output.close();

    medkeep::MedKeep loaded = medkeep::MedKeep::load(path.string());
    std::string error;
    const auto records = loaded.verify_and_extract(error);
    require(records.empty());
    require(error.find("Integrity verification failed at record 2") != std::string::npos);

    std::filesystem::remove(path);
}

}  // namespace

int main() {
    test_empty_chain();
    test_fifo_and_hash_chain();
    test_queue_preserves_fifo_order();
    test_persistence_includes_pending_requests();
    test_tampering_is_detected();
    test_multiline_utf8_and_empty_content_persist();
    test_earlier_hash_tampering_breaks_later_link();

    std::cout << "All MedKeep tests passed.\n";
    return 0;
}
