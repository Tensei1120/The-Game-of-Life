-- モバイル人生ゲーム データベースセットアップ
-- Supabase ダッシュボード → SQL Editor で実行してください

-- ルームテーブル
CREATE TABLE IF NOT EXISTS rooms (
  id                   TEXT        PRIMARY KEY,
  host_id              TEXT        NOT NULL,
  status               TEXT        NOT NULL DEFAULT 'waiting',
  current_player_index INTEGER     NOT NULL DEFAULT 0,
  turn_number          INTEGER     NOT NULL DEFAULT 0,
  alive_cells          JSONB       NOT NULL DEFAULT '[]',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- プレイヤーテーブル
CREATE TABLE IF NOT EXISTS room_players (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     TEXT        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id   TEXT        NOT NULL,
  player_name TEXT        NOT NULL,
  color       TEXT        NOT NULL,
  is_host     BOOLEAN     NOT NULL DEFAULT FALSE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, player_id)
);

-- Row Level Security (全公開ポリシー)
ALTER TABLE rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_rooms"   ON rooms        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_players" ON room_players FOR ALL USING (true) WITH CHECK (true);

-- Realtime 機能を有効化
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_players;
