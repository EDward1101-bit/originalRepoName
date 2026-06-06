#!/bin/bash
# Generate self-signed certificates for the server domain

HOSTNAME=${SERVER_HOSTNAME:-localhost}
CERTS_DIR="./data/certs"

mkdir -p "$CERTS_DIR"

openssl req -new -x509 -days 365 -nodes \
    -newkey rsa:2048 \
    -out "$CERTS_DIR/${HOSTNAME}.crt" \
    -keyout "$CERTS_DIR/${HOSTNAME}.key" \
    -subj "/CN=${HOSTNAME}/O=XMPP Chat/C=US"

echo "Certificates generated for ${HOSTNAME} in $CERTS_DIR"
