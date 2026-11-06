# MedKeep

MedKeep is an offline medical-record logging application written in C++17. It implements the data structures required by Project 1 without using a ready-made linked list or queue.

## Source layout

- `src/main.cpp` contains only the C++ entry point and delegates to `run_application`.
- `src/application.hpp` and `src/application.cpp` contain command-line handling, the menu, input/output, and application-level error handling.
- `src/medkeep.hpp` and `src/medkeep.cpp` coordinate the application and contain archive persistence.
- `src/log_chain.hpp` and `src/log_chain.cpp` implement the manual linked hash chain and its private FNV-1a hashing.
- `src/request_queue.hpp` and `src/request_queue.cpp` implement the manual FIFO request queue.

## Implemented requirements

1. **Singly linked hash chain**
   - The chain is built from manually allocated nodes connected through a `previous` pointer (`std::unique_ptr<Node>`).
   - Every record is represented by two consecutive nodes: a record node and a hash node.
   - A hash node stores the custom FNV-1a 64-bit hash associated with its record node. The newest hash node is the head of the list.
   - The first record uses an empty previous hash.

2. **Integrity verification and extraction**
   - Verification walks from the newest hash node toward the oldest node.
   - It checks the expected `Hash -> Record -> Hash` structure, matching IDs, and every stored hash.
   - The hash is recalculated from the previous hash, record ID, content length, and content.
   - Records are returned only if the entire chain is valid. The returned records are in chronological order.

3. **Request queue**
   - Pending requests are stored in a manually implemented singly linked FIFO queue.
   - The queue maintains both head and tail pointers, so enqueue and dequeue are O(1).
   - Requests are committed to the hash chain in FIFO order.

4. **Persistence**
   - The application saves committed records and pending requests to a local archive file.
   - Content is hex-encoded in the archive so newlines, tabs, and arbitrary UTF-8 bytes are preserved.
   - Loading preserves stored hashes as they are; it does not silently repair a modified chain.
   - The archive is written to a temporary file and then renamed into place.

5. **Low-level language bonus**
   - The implementation uses C++17, one of the languages listed for the language bonus.

## Hash construction

MedKeep implements the FNV-1a 64-bit hash directly in C++ without a hashing library. For each record it hashes this byte sequence:

```text
"MedKeep/FNV1a64/v1\0" || previous_hash || record_id_be || content_length_be || content
```

The implementation starts with the 64-bit FNV offset basis. For every byte, it XORs the byte into the hash and multiplies by the FNV prime using unsigned 64-bit arithmetic. `record_id_be` and `content_length_be` are each encoded as eight-byte big-endian unsigned integers. The final 64-bit value is stored as 16 lowercase hexadecimal characters. The archive header is `MEDKEEP	2` for this hash format.

FNV-1a is simple and suitable for demonstrating a self-implemented hash function in this data-structures project, but it is **not cryptographically secure**. Its 64-bit output provides less collision resistance than SHA-256, and the algorithm is not designed to resist deliberate collision attempts. It must not be used to protect real medical records or other security-sensitive data.

## Build requirements

- A C++17 compiler
- CMake 3.16 or newer

On Arch Linux:

```bash
sudo pacman -S --needed base-devel cmake
```

Build:

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build
```

Run tests:

```bash
ctest --test-dir build --output-on-failure
```

Run the application:

```bash
./build/medkeep_cli
```

A different archive path can be selected with:

```bash
./build/medkeep_cli --file hospital_records.db
```

The default archive is `medkeep.db` in the current working directory. The application loads it at startup when it exists and automatically saves after queue and processing operations. To enter a multi-line record, type its lines and finish with a line containing `.end` by itself.

## Menu

```text
1. Queue a new medical record
2. Process the oldest request
3. Process all pending requests
4. Verify the chain and extract records
5. Display pending requests
6. Save the archive
7. Display statistics
0. Save and exit
```

## Data structure and complexity

Let `n` be the number of committed records and `q` the number of pending requests.

| Operation | Complexity |
|---|---:|
| Add request to queue | O(1) |
| Remove oldest request | O(1) |
| Commit one record | O(1) hash-chain insertion, plus O(content length) hashing |
| Verify and extract all records | O(total stored content bytes + n) |
| List pending requests | O(q) |
| Save or load archive | O(total archive size) |

Each record adds two linked-list nodes. The record node points to the previous hash node; its following hash node stores the digest for that record. While traversing backward from the head, the record nodes occupy the even positions (2nd, 4th, 6th, ...).

## Important security limitation

A hash chain detects content changes when the stored subsequent hashes are left unchanged. FNV-1a is not cryptographically secure and does not authenticate the archive: someone who can rewrite the entire file can recalculate every digest. A production medical system would also need authenticated checkpoints or digital signatures, access control, encryption at rest and in transit, audit logging, and appropriate privacy protections. This project is an educational data-structures implementation, not a clinical record system.

## Interpretation of the mutable-node note

The brief mentions that some content nodes may remain mutable until another request is registered, while the verification section says that content nodes are the even-positioned nodes during reverse traversal and should be displayed after verification. MedKeep keeps unprocessed requests in the separate FIFO queue and adds a record to the chain only when it can create the matching hash node as well. This avoids leaving an unhashed record in the committed chain; every record returned by extraction has passed verification.
