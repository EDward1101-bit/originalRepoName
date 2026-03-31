FROM prosody/prosody:latest

RUN apt-get update && apt-get install -y \
    lua-sec \
    lua-socket \
    && rm -rf /var/lib/apt/lists/*

COPY prosody.yml /etc/prosody/prosody.cfg.lua
COPY data/ /var/lib/prosody/
COPY modules/ /usr/lib/prosody/modules/

EXPOSE 5222 5269 5280 5281

CMD ["prosodyctl", "run"]
