#include "medkeep.hpp"

#include <filesystem>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <utility>
#include <string>

namespace {

bool read_choice(int& choice) {
    std::cout << "\nSelect an option: ";
    std::string line;
    if (!std::getline(std::cin, line)) {
        return false;
    }

    try {
        std::size_t parsed = 0;
        const long value = std::stol(line, &parsed);
        if (parsed != line.size() || value < std::numeric_limits<int>::min() ||
            value > std::numeric_limits<int>::max()) {
            std::cout << "Invalid option. Enter a number from the menu.\n";
            return true;
        }
        choice = static_cast<int>(value);
    } catch (const std::exception&) {
        std::cout << "Invalid option. Enter a number from the menu.\n";
    }
    return true;
}

bool read_record(std::string& content) {
    std::cout << "Enter the record. Finish with a line containing .end\n";
    content.clear();
    bool first_line = true;
    std::string line;

    while (std::getline(std::cin, line)) {
        if (line == ".end") {
            return true;
        }
        if (!first_line) {
            content.push_back('\n');
        }
        content += line;
        first_line = false;
    }
    return false;
}

void save_safely(const medkeep::MedKeep& application, const std::string& path) {
    try {
        application.save(path);
        std::cout << "Archive saved to " << path << ".\n";
    } catch (const std::exception& error) {
        std::cout << "Could not save the archive: " << error.what() << '\n';
    }
}

void print_menu() {
    std::cout << "\n========== MedKeep =========="
              << "\n1. Queue a new medical record"
              << "\n2. Process the oldest request"
              << "\n3. Process all pending requests"
              << "\n4. Verify the chain and extract records"
              << "\n5. Display pending requests"
              << "\n6. Save the archive"
              << "\n7. Display statistics"
              << "\n0. Save and exit\n";
}

}  // namespace

int main(int argc, char* argv[]) {
    std::string archive_path = "medkeep.db";
    for (int i = 1; i < argc; ++i) {
        const std::string argument = argv[i];
        if (argument == "--file" && i + 1 < argc) {
            archive_path = argv[++i];
        } else if (argument == "--help") {
            std::cout << "Usage: medkeep_cli [--file ARCHIVE_PATH]\n";
            return 0;
        } else {
            std::cerr << "Unknown or incomplete argument: " << argument << '\n';
            std::cerr << "Usage: medkeep_cli [--file ARCHIVE_PATH]\n";
            return 1;
        }
    }

    medkeep::MedKeep application;
    if (std::filesystem::exists(archive_path)) {
        try {
            application = medkeep::MedKeep::load(archive_path);
            std::cout << "Loaded " << application.record_count() << " committed record(s) and "
                      << application.pending_count() << " pending request(s) from "
                      << archive_path << ".\n";
        } catch (const std::exception& error) {
            std::cerr << "Could not load the archive: " << error.what() << '\n';
            return 1;
        }
    } else {
        std::cout << "No existing archive found. A new MedKeep chain will be created.\n";
    }

    while (true) {
        print_menu();
        int choice = -1;
        if (!read_choice(choice)) {
            std::cout << "\nInput ended. Saving before exit.\n";
            save_safely(application, archive_path);
            break;
        }

        try {
            if (choice == 1) {
                std::string content;
                if (!read_record(content)) {
                    std::cout << "Input ended before the record was completed.\n";
                    save_safely(application, archive_path);
                    break;
                }
                const std::uint64_t id = application.enqueue_request(std::move(content));
                std::cout << "Request #" << id << " added to the queue.\n";
                save_safely(application, archive_path);
            } else if (choice == 2) {
                if (application.process_next()) {
                    std::cout << "The oldest request was committed to the hash chain.\n";
                    save_safely(application, archive_path);
                } else {
                    std::cout << "There are no pending requests.\n";
                }
            } else if (choice == 3) {
                const std::size_t processed = application.process_all();
                std::cout << processed << " request(s) committed.\n";
                if (processed > 0) {
                    save_safely(application, archive_path);
                }
            } else if (choice == 4) {
                std::string error;
                const std::vector<medkeep::Record> records =
                    application.verify_and_extract(error);
                if (!error.empty()) {
                    std::cout << "CHAIN INVALID: " << error << '\n';
                } else {
                    std::cout << "Chain verified. Extracted " << records.size()
                              << " record(s) in chronological order.\n";
                    for (const medkeep::Record& record : records) {
                        std::cout << "\nRecord #" << record.id << "\n"
                                  << "SHA-256: " << record.digest << '\n'
                                  << record.content << '\n';
                    }
                }
            } else if (choice == 5) {
                const std::vector<medkeep::Request> pending = application.pending_requests();
                if (pending.empty()) {
                    std::cout << "The request queue is empty.\n";
                } else {
                    std::cout << "Pending requests (oldest first):\n";
                    for (const medkeep::Request& request : pending) {
                        std::cout << "\nRequest #" << request.id << "\n"
                                  << request.content << '\n';
                    }
                }
            } else if (choice == 6) {
                save_safely(application, archive_path);
            } else if (choice == 7) {
                std::cout << "Committed records: " << application.record_count()
                          << "\nPending requests: " << application.pending_count()
                          << "\nArchive: " << archive_path << '\n';
            } else if (choice == 0) {
                save_safely(application, archive_path);
                break;
            } else {
                std::cout << "Unknown menu option.\n";
            }
        } catch (const std::exception& error) {
            std::cout << "Operation failed: " << error.what() << '\n';
        }
    }

    return 0;
}
