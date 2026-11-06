#include "application.hpp"
#include "medkeep.hpp"

#include <cstdint>
#include <cstdlib>
#include <filesystem>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

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
              << "\n\n1. Add a new medical record"
              << "\n2. Process the oldest request"
              << "\n3. Verify and extract records"
              << "\n0. Save and exit\n";
}

void clear_screen() {
    std::system("clear");
}

bool wait_for_enter() {
    std::cout << "\nPress Enter to continue...";
    std::string line;
    return static_cast<bool>(std::getline(std::cin, line));
}

}  // namespace

namespace medkeep {

int run_application() {
    const std::string archive_path = "medkeep.db";
    medkeep::MedKeep application;
    if (std::filesystem::exists(archive_path)) {
        try {
            application = medkeep::MedKeep::load(archive_path);
            std::cout << "Archive loaded successfully.\n";
        } catch (const std::exception& error) {
            std::cerr << "Could not load the archive: " << error.what() << '\n';
            return 1;
        }
    } else {
        std::cout << "No existing archive found. A new MedKeep chain will be created.\n";
    }

    clear_screen();
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
                                  << "FNV-1a 64-bit: " << record.digest << '\n'
                                  << record.content << '\n';
                    }
                }
            } else if (choice == 0) {
                save_safely(application, archive_path);
                break;
            } else {
                std::cout << "Unknown menu option.\n";
            }
            if (wait_for_enter()) {
                clear_screen();
            }
        } catch (const std::exception& error) {
            std::cout << "Operation failed: " << error.what() << '\n';
            if (wait_for_enter()) {
                clear_screen();
            }
        }
    }

    return 0;
}
}  // namespace medkeep
