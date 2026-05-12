-- Run this in the Supabase SQL editor to enable message reactions.

-- Reactions on DMs
create table if not exists public.message_reactions (
  id         uuid        primary key default gen_random_uuid(),
  message_id uuid        not null references public.messages(id) on delete cascade,
  user_id    uuid        not null references public.users(id) on delete cascade,
  emoji      text        not null check (char_length(emoji) <= 8),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

alter table public.message_reactions enable row level security;

create policy "Anyone can read reactions"
  on public.message_reactions for select using (true);

create policy "Users can insert their own reactions"
  on public.message_reactions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own reactions"
  on public.message_reactions for delete
  using (auth.uid() = user_id);

-- Reactions on room messages
create table if not exists public.room_message_reactions (
  id         uuid        primary key default gen_random_uuid(),
  message_id uuid        not null references public.room_messages(id) on delete cascade,
  user_id    uuid        not null references public.users(id) on delete cascade,
  emoji      text        not null check (char_length(emoji) <= 8),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

alter table public.room_message_reactions enable row level security;

create policy "Anyone can read room reactions"
  on public.room_message_reactions for select using (true);

create policy "Users can insert their own room reactions"
  on public.room_message_reactions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own room reactions"
  on public.room_message_reactions for delete
  using (auth.uid() = user_id);

-- Enable realtime for both tables
alter publication supabase_realtime add table public.message_reactions;
alter publication supabase_realtime add table public.room_message_reactions;
