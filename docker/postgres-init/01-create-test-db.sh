#!/bin/sh
# APIテスト専用DB highdea_test を作成する（開発データを壊さないため分離: standards/testing.md §6.3）
# docker-entrypoint-initdb.d のスクリプトはボリュームが空の初回起動時のみ実行される
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
  CREATE DATABASE highdea_test OWNER "$POSTGRES_USER";
SQL
