#!/bin/bash
# Generate self-signed certificates for localhost

CERTS_DIR="./data/certs"

mkdir -p "$CERTS_DIR"

openssl req -new -x509 -days 365 -nodes \
    -newkey rsa:2048 \
    -out "$CERTS_DIR/localhost.crt" \
    -keyout "$CERTS_DIR/localhost.key" \
    -subj "/CN=localhost/O=XMPP Chat/C=US"

echo "Certificates generated in $CERTS_DIR"
