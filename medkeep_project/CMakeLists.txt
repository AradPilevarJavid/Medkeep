cmake_minimum_required(VERSION 3.16)
project(MedKeep LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(OpenSSL REQUIRED)

add_library(medkeep src/medkeep.cpp)
target_include_directories(medkeep PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/src)
target_link_libraries(medkeep PUBLIC OpenSSL::Crypto)
target_compile_options(medkeep PRIVATE -Wall -Wextra -Wpedantic)

add_executable(medkeep_cli src/main.cpp)
target_link_libraries(medkeep_cli PRIVATE medkeep)
target_compile_options(medkeep_cli PRIVATE -Wall -Wextra -Wpedantic)

include(CTest)
if(BUILD_TESTING)
    add_executable(medkeep_tests tests/test_medkeep.cpp)
    target_link_libraries(medkeep_tests PRIVATE medkeep)
    target_compile_options(medkeep_tests PRIVATE -Wall -Wextra -Wpedantic)
    add_test(NAME medkeep_tests COMMAND medkeep_tests)
endif()
