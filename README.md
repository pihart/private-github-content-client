# Private GitHub Content Client

A dependency-free browser helper for public static shells that unlock private
GitHub repository content with a user-supplied fine-grained token.

It keeps the token in caller-selected session storage, sends it only to the
GitHub REST API, and requests content with `cache: no-store`. It does not
execute downloaded code or store private responses.

Consumers should request only **Contents: Read** and must keep private content
out of their deployment artifacts.
