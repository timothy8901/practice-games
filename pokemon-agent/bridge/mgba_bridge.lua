-- mGBA Lua bridge for Pokemon Emerald autonomous agent.
-- Opens a TCP server on 127.0.0.1:8888. One client at a time.
-- Line protocol. Each request gets exactly one response line ending in \n.

local PORT = 8888
local HOST = "127.0.0.1"

local KEY = {
  A      = 0x001,
  B      = 0x002,
  SELECT = 0x004,
  START  = 0x008,
  RIGHT  = 0x010,
  LEFT   = 0x020,
  UP     = 0x040,
  DOWN   = 0x080,
  R      = 0x100,
  L      = 0x200,
}

local server = nil
local client = nil
local recvbuf = ""

-- Pending actions: a queue of frames to run.
-- Each entry = { mask = bitmask, frames = N, reply_when_done = bool }
local queue = {}
local frame_counter = 0

local function trim(s)
  return (s:gsub("^%s+", ""):gsub("%s+$", ""))
end

local function log(msg)
  if console and console.log then console:log("[bridge] " .. tostring(msg)) end
end

local function send_line(text)
  if not client then return end
  local ok, err = pcall(function() client:send(text .. "\n") end)
  if not ok then
    log("send failed: " .. tostring(err))
    pcall(function() client:close() end)
    client = nil
    recvbuf = ""
  end
end

local function parse_key(name)
  if not name then return nil end
  local up = name:upper()
  if up == "NONE" or up == "WAIT" then return 0 end
  return KEY[up]
end

-- Handle one command line. If the command is instant, we write the reply here.
-- If the command enqueues frames, the reply is written when the queue drains to it.
local function handle(line)
  line = trim(line)
  if line == "" then return end
  local cmd, rest = line:match("^(%S+)%s*(.*)$")
  cmd = (cmd or ""):upper()
  rest = rest or ""

  if cmd == "PING" then
    send_line("PONG")

  elseif cmd == "PRESS" then
    -- PRESS <KEY> <HOLD_FRAMES> [RELEASE_FRAMES]
    local k, hold, release = rest:match("^(%S+)%s+(%d+)%s*(%d*)$")
    if not k then send_line("ERR bad_press"); return end
    local mask = parse_key(k)
    if mask == nil then send_line("ERR unknown_key " .. k); return end
    local h = tonumber(hold) or 5
    local r = tonumber(release)
    if r == nil or r == 0 then r = 5 end
    table.insert(queue, {mask = mask, frames = h, reply = false})
    table.insert(queue, {mask = 0,    frames = r, reply = true})

  elseif cmd == "WAIT" then
    local n = tonumber(rest)
    if not n then send_line("ERR bad_wait"); return end
    table.insert(queue, {mask = 0, frames = n, reply = true})

  elseif cmd == "SEQ" then
    -- SEQ K:HOLD:REL,K:HOLD:REL,...   (REL optional, default 5)
    -- single reply fires when the whole sequence finishes
    local parts = {}
    for item in rest:gmatch("([^,]+)") do
      local k, h, r = item:match("^(%S+):(%d+):(%d+)$")
      if not k then k, h = item:match("^(%S+):(%d+)$"); r = "5" end
      if not k then send_line("ERR bad_seq " .. item); return end
      local mask = parse_key(k)
      if mask == nil then send_line("ERR unknown_key " .. k); return end
      parts[#parts+1] = {mask = mask, hold = tonumber(h), release = tonumber(r)}
    end
    if #parts == 0 then send_line("ERR empty_seq"); return end
    for i, p in ipairs(parts) do
      local is_last = (i == #parts)
      table.insert(queue, {mask = p.mask, frames = p.hold,    reply = false})
      table.insert(queue, {mask = 0,      frames = p.release, reply = is_last})
    end

  elseif cmd == "SCREEN" then
    if rest == "" then send_line("ERR no_path"); return end
    local ok, err = pcall(function() emu:screenshot(rest) end)
    if ok then send_line("OK " .. rest) else send_line("ERR " .. tostring(err)) end

  elseif cmd == "READ" then
    -- READ <ADDR> <SIZE>
    local addr_s, size_s = rest:match("^(%S+)%s+(%d+)$")
    if not addr_s then send_line("ERR bad_read"); return end
    local a = tonumber(addr_s)
    if not a and addr_s:sub(1,2) == "0x" then a = tonumber(addr_s:sub(3), 16) end
    local s = tonumber(size_s)
    if not a then send_line("ERR bad_addr"); return end
    local v
    if s == 1 then v = emu:read8(a)
    elseif s == 2 then v = emu:read16(a)
    elseif s == 4 then v = emu:read32(a)
    else send_line("ERR bad_size"); return end
    send_line(string.format("OK 0x%x", v))

  elseif cmd == "READRANGE" then
    -- READRANGE <ADDR> <LEN>
    local addr_s, len_s = rest:match("^(%S+)%s+(%d+)$")
    if not addr_s then send_line("ERR bad_readrange"); return end
    local a = tonumber(addr_s)
    if not a and addr_s:sub(1,2) == "0x" then a = tonumber(addr_s:sub(3), 16) end
    local n = tonumber(len_s)
    if not a or not n then send_line("ERR bad_args"); return end
    if n > 4096 then send_line("ERR too_long"); return end
    local t = {}
    for i = 0, n - 1 do t[#t+1] = string.format("%02x", emu:read8(a + i)) end
    send_line("OK " .. table.concat(t))

  elseif cmd == "SAVESTATE" then
    if rest == "" then send_line("ERR no_path"); return end
    local ok, err = pcall(function() emu:saveStateFile(rest) end)
    if ok then send_line("OK " .. rest) else send_line("ERR " .. tostring(err)) end

  elseif cmd == "LOADSTATE" then
    if rest == "" then send_line("ERR no_path"); return end
    local ok, err = pcall(function() emu:loadStateFile(rest) end)
    if ok then send_line("OK " .. rest) else send_line("ERR " .. tostring(err)) end

  elseif cmd == "ROMINFO" then
    local title = emu:getGameTitle() or "?"
    local code = emu:getGameCode() or "?"
    send_line("OK " .. title .. " " .. code)

  elseif cmd == "FRAME" then
    send_line("OK " .. tostring(frame_counter))

  elseif cmd == "RESETQ" then
    queue = {}
    send_line("OK")

  else
    send_line("ERR unknown_cmd " .. cmd)
  end
end

local function drain_buffer()
  while true do
    local nl = recvbuf:find("\n", 1, true)
    if not nl then return end
    local line = recvbuf:sub(1, nl - 1):gsub("\r$", "")
    recvbuf = recvbuf:sub(nl + 1)
    handle(line)
  end
end

local function on_client_data()
  if not client then return end
  while true do
    local data, err = client:receive(4096)
    if data and #data > 0 then
      recvbuf = recvbuf .. data
    else
      -- no more data right now; if there was an error other than "again", disconnect
      if err and err ~= socket.ERRORS.AGAIN then
        log("client recv err: " .. tostring(err))
        pcall(function() client:close() end)
        client = nil
        recvbuf = ""
        queue = {}
      end
      break
    end
  end
  drain_buffer()
end

local function on_client_error()
  log("client error event")
  if client then pcall(function() client:close() end) end
  client = nil
  recvbuf = ""
  queue = {}
end

local function on_accept()
  local new_client, err = server:accept()
  if not new_client then
    log("accept err: " .. tostring(err))
    return
  end
  -- A new connection always replaces the old one. mGBA's socket does not
  -- reliably surface peer-FIN, so we treat "new client arrived" as proof
  -- that any previous client is gone.
  if client then
    log("replacing stale client")
    pcall(function() client:close() end)
  end
  client = new_client
  recvbuf = ""
  queue = {}
  client:add("received", on_client_data)
  client:add("error", on_client_error)
  log("client connected")
end

local function on_frame()
  frame_counter = frame_counter + 1
  if #queue == 0 then
    emu:setKeys(0)
    return
  end
  local head = queue[1]
  if head.frames > 0 then
    emu:setKeys(head.mask)
    head.frames = head.frames - 1
    return
  end
  emu:setKeys(0)
  if head.reply then send_line("OK") end
  table.remove(queue, 1)
end

local function start_server()
  local s, err = socket.bind(HOST, PORT)
  if not s then log("bind failed: " .. tostring(err)); return end
  local ok2, err2 = pcall(function() s:listen() end)
  if not ok2 then log("listen failed: " .. tostring(err2)); return end
  server = s
  server:add("received", on_accept)
  log("listening on " .. HOST .. ":" .. PORT)
end

callbacks:add("frame", on_frame)
start_server()
log("ready")
