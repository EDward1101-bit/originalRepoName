-- Run this in the Supabase SQL editor to enable message pinning.

-- Pinned messages for DMs (identified by a canonical conversation key)
create table if not exists public.pinned_dm_messages (
  id               uuid        primary key default gen_random_uuid(),
  message_id       uuid        not null references public.messages(id) on delete cascade,
  conversation_key text        not null,  -- sorted "{userId1}:{userId2}"
  body_preview     text        not null,
  pinned_by        uuid        not null references public.users(id) on delete cascade,
  pinned_at        timestamptz not null default now()
);

alter table public.pinned_dm_messages enable row level security;
create policy "Anyone can read pinned DM messages"
  on public.pinned_dm_messages for select using (true);
create policy "Users can pin DM messages"
  on public.pinned_dm_messages for insert with check (auth.uid() = pinned_by);
create policy "Users can unpin DM messages"
  on public.pinned_dm_messages for delete using (auth.uid() = pinned_by);

-- Pinned messages for rooms
create table if not exists public.pinned_room_messages (
  id           uuid        primary key default gen_random_uuid(),
  message_id   uuid        not null references public.room_messages(id) on delete cascade,
  room_name    text        not null,
  body_preview text        not null,
  pinned_by    uuid        not null references public.users(id) on delete cascade,
  pinned_at    timestamptz not null default now()
);

alter table public.pinned_room_messages enable row level security;
create policy "Anyone can read pinned room messages"
  on public.pinned_room_messages for select using (true);
create policy "Users can pin room messages"
  on public.pinned_room_messages for insert with check (auth.uid() = pinned_by);
create policy "Users can unpin room messages"
  on public.pinned_room_messages for delete using (auth.uid() = pinned_by);

-- Enable realtime
alter publication supabase_realtime add table public.pinned_dm_messages;
alter publication supabase_realtime add table public.pinned_room_messages;
