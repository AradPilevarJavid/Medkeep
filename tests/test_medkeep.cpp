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

void test_old_archive_version_is_rejected() {
    const auto path = temporary_path("old_archive_version");
    {
        std::ofstream output(path, std::ios::binary | std::ios::trunc);
        output << "MEDKEEP\t1\n";
    }

    bool rejected = false;
    try {
        (void)medkeep::MedKeep::load(path.string());
    } catch (const std::runtime_error&) {
        rejected = true;
    }
    require(rejected);
    std::filesystem::remove(path);
}

void test_empty_chain() {
    medkeep::MedKeep application;
    std::string error;
    const auto records = application.verify_and_extract(error);
    require(error.empty());
    require(records.empty());
}

void test_fifo_and_hash_chain() {
    medkeep::MedKeep application;
    require(application.enqueue_request("first patient") == 1);
    require(application.enqueue_request("second patient") == 2);
    require(application.enqueue_request("third patient") == 3);

    require(application.process_next());
    require(application.process_next());
    require(application.process_next());
    require(!application.process_next());

    std::string error;
    const auto records = application.verify_and_extract(error);
    require(error.empty());
    require(records.size() == 3);
    require(records[0].id == 1 && records[0].content == "first patient");
    require(records[1].id == 2 && records[1].content == "second patient");
    require(records[2].id == 3 && records[2].content == "third patient");
    require(records[0].digest == "30d909a7a87b317c");
    require(records[0].digest.size() == 16);
}

void test_queue_processes_fifo_order_one_at_a_time() {
    medkeep::MedKeep application;
    require(application.enqueue_request("first") == 1);
    require(application.enqueue_request("second") == 2);
    require(application.enqueue_request("third") == 3);

    for (const std::string expected : {"first", "second", "third"}) {
        require(application.process_next());
        std::string error;
        const auto records = application.verify_and_extract(error);
        require(error.empty());
        require(records.back().content == expected);
    }
    require(!application.process_next());
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
    require(loaded.process_next());
    require(loaded.process_next());
    require(!loaded.process_next());
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
    require(application.process_next());
    require(application.process_next());
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
    test_old_archive_version_is_rejected();
    test_empty_chain();
    test_fifo_and_hash_chain();
    test_queue_processes_fifo_order_one_at_a_time();
    test_persistence_includes_pending_requests();
    test_tampering_is_detected();
    test_multiline_utf8_and_empty_content_persist();
    test_earlier_hash_tampering_breaks_later_link();

    std::cout << "All MedKeep tests passed.\n";
    return 0;
}
