// ════════ Markdown & emoji ════════
'use strict';
const EMOJI_CATS = [
  ['Yüzler', '😀 grinning sırıtma|😃 smiley|😄 smile gülme|😁 grin|😆 laughing kahkaha|😅 sweat_smile|🤣 rofl yerlerde|😂 joy gözyaşı|🙂 slight_smile|🙃 upside_down ters|😉 wink göz_kırp|😊 blush|😇 innocent melek|🥰 smiling_hearts aşk|😍 heart_eyes|🤩 star_struck|😘 kissing_heart öpücük|😋 yum|😛 tongue dil|😜 wink_tongue|🤪 zany çılgın|😝 squint_tongue|🤑 money para|🤗 hugging sarıl|🤭 hand_mouth|🤫 shush sus|🤔 thinking düşünen|🤐 zipper|🤨 raised_eyebrow kaş|😐 neutral|😑 expressionless|😶 no_mouth|😏 smirk|😒 unamused|🙄 eye_roll göz_devir|😬 grimace|😌 relieved|😔 pensive|😪 sleepy|🤤 drool salya|😴 sleeping uyku|😷 mask maske|🤒 sick hasta|🤕 bandage|🤢 nauseated|🤮 vomit kusma|🥵 hot sıcak|🥶 cold soğuk|🥴 woozy|😵 dizzy|🤯 exploding beyin|🤠 cowboy|🥳 party parti|😎 sunglasses havalı|🤓 nerd inek|🧐 monocle|😕 confused|😟 worried|🙁 frown|😮 open_mouth|😯 hushed|😲 astonished şaşkın|😳 flushed utanma|🥺 pleading yalvarma|😦 frowning|😧 anguished|😨 fearful|😰 anxious|😥 sad_relieved|😢 cry ağla|😭 sob hüngür|😱 scream çığlık|😖 confounded|😣 persevere|😞 disappointed|😓 sweat|😩 weary|😫 tired yorgun|🥱 yawn esneme|😤 triumph|😡 rage öfke|😠 angry kızgın|🤬 cursing küfür|😈 smiling_imp şeytan|👿 imp|💀 skull kafatası|☠️ crossbones|💩 poop kaka|🤡 clown palyaço|👹 ogre|👻 ghost hayalet|👽 alien uzaylı|🤖 robot|😺 cat_smile|😹 cat_joy|😻 cat_heart|🙈 see_no_evil maymun|🙉 hear_no_evil|🙊 speak_no_evil'],
  ['İnsanlar', '👋 wave el_salla|🤚 raised_back|✋ hand el|🖖 vulcan|👌 ok_hand tamam|🤌 pinched|✌️ v peace|🤞 crossed şans|🤟 love_you|🤘 metal rock|🤙 call_me|👈 left|👉 right|👆 up|👇 down|☝️ point|👍 thumbsup beğen|👎 thumbsdown beğenme|✊ fist|👊 punch yumruk|🤛 left_fist|🤜 right_fist|👏 clap alkış|🙌 raised_hands|👐 open_hands|🤲 palms|🤝 handshake tokalaşma|🙏 pray dua|✍️ writing|💪 muscle kas|🧠 brain beyin|👀 eyes gözler|👁️ eye|👅 tongue|👄 lips|🫶 heart_hands|👶 baby bebek|🧒 child|👦 boy|👧 girl|🧑 person|👨 man|👩 woman|🧓 older|👴 old_man dede|👵 old_woman nine|🕵️ detective|👮 police polis|👷 worker|💂 guard|🥷 ninja|🧙 mage büyücü|🧛 vampire|🧟 zombie|🧞 genie|🤷 shrug omuz|🤦 facepalm|🙋 raising_hand|🙇 bow|💃 dancer dans|🕺 man_dance|🏃 running koşu|🚶 walking'],
  ['Kalpler', '❤️ heart kalp|🧡 orange_heart|💛 yellow_heart|💚 green_heart|💙 blue_heart|💜 purple_heart|🖤 black_heart|🤍 white_heart|🤎 brown_heart|💔 broken_heart kırık|❣️ heart_exclamation|💕 two_hearts|💞 revolving|💓 heartbeat|💗 growing|💖 sparkling_heart|💘 cupid|💝 gift_heart|💟 heart_decoration|♥️ hearts|💯 100 yüz|💢 anger|💥 boom patlama|💫 dizzy_star|💦 sweat_drops|💨 dash|💬 speech|💭 thought|💤 zzz|✨ sparkles parıltı|⭐ star yıldız|🌟 glowing_star|🔥 fire ateş|⚡ zap şimşek|🎉 tada kutlama|🎊 confetti|🎈 balloon balon|🎁 gift hediye|🏆 trophy kupa|🥇 first|🥈 second|🥉 third|🏅 medal'],
  ['Doğa', '🐶 dog köpek|🐱 cat kedi|🐭 mouse|🐹 hamster|🐰 rabbit tavşan|🦊 fox tilki|🐻 bear ayı|🐼 panda|🐨 koala|🐯 tiger kaplan|🦁 lion aslan|🐮 cow inek|🐷 pig domuz|🐸 frog kurbağa|🐵 monkey maymun|🐔 chicken tavuk|🐧 penguin|🐦 bird kuş|🦆 duck ördek|🦅 eagle kartal|🦉 owl baykuş|🦇 bat|🐺 wolf kurt|🐴 horse at|🦄 unicorn|🐝 bee arı|🐛 bug|🦋 butterfly kelebek|🐌 snail|🐞 ladybug|🐢 turtle kaplumbağa|🐍 snake yılan|🐙 octopus|🦈 shark köpekbalığı|🐬 dolphin yunus|🐳 whale balina|🐟 fish balık|🦖 trex|🐉 dragon ejderha|🌵 cactus|🎄 tree_xmas|🌲 evergreen|🌳 tree ağaç|🌴 palm|🍀 clover yonca|🍁 maple|🌹 rose gül|🌻 sunflower ayçiçeği|🌸 blossom çiçek|🌷 tulip lale|🌞 sun_face|🌝 moon_face|🌙 moon ay|🌍 earth dünya|☀️ sun güneş|⛅ cloud_sun|🌧️ rain yağmur|⛈️ storm|❄️ snowflake kar|☃️ snowman|🌈 rainbow gökkuşağı|🌊 wave dalga'],
  ['Yiyecek', '🍏 green_apple|🍎 apple elma|🍐 pear armut|🍊 orange portakal|🍋 lemon limon|🍌 banana muz|🍉 watermelon karpuz|🍇 grapes üzüm|🍓 strawberry çilek|🍒 cherries kiraz|🍑 peach şeftali|🥭 mango|🍍 pineapple ananas|🥥 coconut|🥝 kiwi|🍅 tomato domates|🍆 eggplant patlıcan|🥑 avocado|🌶️ pepper biber|🌽 corn mısır|🥕 carrot havuç|🥔 potato patates|🍞 bread ekmek|🥐 croissant|🥖 baguette|🧀 cheese peynir|🥚 egg yumurta|🍳 cooking|🥓 bacon|🍔 hamburger|🍟 fries patates_kızartması|🍕 pizza|🌭 hotdog|🥪 sandwich|🌮 taco|🌯 burrito|🥙 doner döner|🧆 falafel|🍝 spaghetti makarna|🍜 ramen|🍣 sushi|🍦 icecream dondurma|🍩 donut|🍪 cookie kurabiye|🎂 cake pasta|🍰 shortcake|🧁 cupcake|🍫 chocolate çikolata|🍬 candy şeker|🍭 lollipop|🍿 popcorn|☕ coffee kahve|🍵 tea çay|🧋 bubble_tea|🥤 cup|🍺 beer|🧃 juice meyve_suyu|🥛 milk süt|🧂 salt'],
  ['Etkinlik', '⚽ soccer futbol|🏀 basketball basketbol|🏈 football|⚾ baseball|🎾 tennis tenis|🏐 volleyball voleybol|🏓 ping_pong|🏸 badminton|🥊 boxing boks|🥋 martial|⛳ golf|🎣 fishing|🏹 bow_arrow|🛹 skateboard|⛸️ skate|🎿 ski kayak|🏂 snowboard|🏋️ lifting|🚴 biking bisiklet|🎮 video_game oyun|🕹️ joystick|🎲 dice zar|🧩 puzzle|♟️ chess satranç|🎯 dart hedef|🎳 bowling|🎰 slot|🎨 art sanat|🎬 clapper film|🎤 microphone mikrofon|🎧 headphones kulaklık|🎼 score|🎹 piano piyano|🥁 drum davul|🎷 sax|🎺 trumpet trompet|🎸 guitar gitar|🎻 violin keman|🎟️ ticket bilet|🎪 circus'],
  ['Nesneler', '⌚ watch saat|📱 phone telefon|💻 laptop|⌨️ keyboard klavye|🖥️ desktop|🖱️ mouse_pc|💾 floppy|💿 cd|📷 camera kamera|🎥 movie_camera|📺 tv televizyon|📻 radio|⏰ alarm|⌛ hourglass|💡 bulb ampul|🔦 flashlight|🕯️ candle mum|💸 money_wings|💵 dollar|💰 moneybag|💎 gem elmas|🔧 wrench|🔨 hammer çekiç|⚙️ gear dişli|🔫 water_gun|💣 bomb bomba|🔪 knife bıçak|🛡️ shield kalkan|🔮 crystal_ball|💊 pill hap|💉 syringe|🧬 dna|🔬 microscope|🔭 telescope|🧹 broom süpürge|🚽 toilet|🛁 bathtub|🔑 key anahtar|🚪 door kapı|🛏️ bed yatak|🎈 balloon2|📦 package paket|📫 mailbox|📝 memo not|📚 books kitaplar|📖 book kitap|🔗 link bağlantı|📎 paperclip|✂️ scissors makas|📌 pushpin raptiye|📍 round_pushpin|🔒 lock kilit|🔓 unlock|🔔 bell zil|🔕 no_bell|📢 loudspeaker|📣 mega|💬 speech2|🗑️ wastebasket çöp'],
  ['Semboller', '✅ white_check_mark onay|☑️ ballot_check|✔️ check tik|❌ x çarpı|❎ cross_mark|➕ plus artı|➖ minus eksi|➗ divide|✖️ multiply|❓ question soru|❔ grey_question|❗ exclamation ünlem|❕ grey_exclamation|‼️ bangbang|⁉️ interrobang|⚠️ warning uyarı|🚫 no_entry_sign yasak|⛔ no_entry|🔞 underage|♻️ recycle|🆗 ok|🆕 new yeni|🆒 cool|🆓 free bedava|🆙 up_sign|🔴 red_circle kırmızı|🟠 orange_circle|🟡 yellow_circle|🟢 green_circle yeşil|🔵 blue_circle mavi|🟣 purple_circle|⚫ black_circle|⚪ white_circle|🟥 red_square|🟩 green_square|🟦 blue_square|▶️ play|⏸️ pause|⏹️ stop|⏩ fast_forward|🔀 shuffle|🔁 repeat|🔇 mute|🔊 loud ses|🎵 music_note nota|🎶 notes|💲 heavy_dollar|©️ copyright|®️ registered|™️ tm|🔟 ten|#️⃣ hash|🇹🇷 tr türkiye|🏳️‍🌈 rainbow_flag|🏴‍☠️ pirate korsan|🏁 checkered'],
];
const EMOJIS = [];
for (const [cat, list] of EMOJI_CATS) for (const item of list.split('|')) { const [e, ...names] = item.trim().split(' '); EMOJIS.push({ e, names, cat }); }
const EMOJI_BY_NAME = new Map();
for (const x of EMOJIS) for (const n of x.names) if (!EMOJI_BY_NAME.has(n)) EMOJI_BY_NAME.set(n, x.e);
const ASCII_EMOJI = { ':)': '🙂', ':-)': '🙂', ':D': '😄', ':(': '🙁', ';)': '😉', ':P': '😛', '<3': '❤️', ':O': '😮', 'xD': '😆' };

const customEmojiUrl = (id) => '/api/emojis/' + id;
function highlightCode(code, lang) {
  if (!lang || code.length > 20000) return esc(code);
  const kw = /\b(const|let|var|function|return|if|else|for|while|class|import|from|export|default|new|this|async|await|try|catch|throw|def|print|self|None|True|False|true|false|null|undefined|public|private|static|void|int|string|bool|struct|fn|pub|use|impl|match|package|func|go|type|interface|extends|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|echo|elif|lambda|in|of|switch|case|break|continue)\b/g;
  const re = /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)/g;
  let out = '', last = 0, m;
  const plain = (s) => esc(s).replace(kw, '<span class="tok-k">$1</span>');
  const isHashComment = ['py', 'python', 'sh', 'bash', 'rb', 'ruby', 'yaml', 'yml', 'toml'].includes(lang);
  while ((m = re.exec(code))) {
    if (m[1] && m[1].startsWith('#') && !isHashComment) { continue; }
    out += plain(code.slice(last, m.index));
    out += m[1] ? `<span class="tok-c">${esc(m[1])}</span>` : m[2] ? `<span class="tok-s">${esc(m[2])}</span>` : `<span class="tok-n">${esc(m[3])}</span>`;
    last = re.lastIndex;
  }
  return out + plain(code.slice(last));
}

// ctx: { users: id->user, channels: id->channel, roles: id->role, meId }
function renderMarkdown(src, ctx = {}, opts = {}) {
  if (!src) return '';
  const holds = [];
  const hold = (html) => `\u0000${holds.push(html) - 1}\u0000`;
  let s = String(src);
  s = s.replace(/```(?:([a-zA-Z0-9+#-]{1,15})\n)?([\s\S]*?)```/g, (_, lang, code) => hold(`<pre><code>${highlightCode(code.replace(/^\n|\n$/g, ''), (lang || '').toLowerCase())}</code></pre>`));
  s = s.replace(/`([^`\n]+)`/g, (_, c) => hold(`<code>${esc(c)}</code>`));
  // Maskeli bağlantılar
  s = s.replace(/\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => hold(`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" data-tip="${esc(u)}">${esc(t)}</a>`));
  s = s.replace(/https?:\/\/[^\s<]+[^\s<.,:;"')\]]/g, (u) => hold(`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u)}</a>`));
  s = s.replace(/<(a?):([a-zA-Z0-9_]{1,32}):(\d{5,20})>/g, (_, a, n, id) => hold(`<img class="emoji" src="${customEmojiUrl(id)}" alt=":${esc(n)}:" data-tip=":${esc(n)}:" draggable="false">`));
  s = s.replace(/<@!?(\d{5,20})>/g, (_, id) => {
    const u = ctx.users?.(id);
    return hold(`<span class="mention-pill" data-user="${id}">@${esc(u ? u.display_name || u.username : 'bilinmeyen')}</span>`);
  });
  s = s.replace(/<@&(\d{5,20})>/g, (_, id) => { const r = ctx.roles?.(id); return hold(`<span class="mention-pill" style="${r?.color ? `color:${r.color};background:${r.color}33` : ''}">@${esc(r?.name || 'silinmiş-rol')}</span>`); });
  s = s.replace(/<#(\d{5,20})>/g, (_, id) => { const c = ctx.channels?.(id); return hold(`<span class="mention-pill" data-channel="${id}">#${esc(c?.name || 'bilinmeyen')}</span>`); });
  s = s.replace(/(^|\s)@(everyone|here)\b/g, (_, p, w) => p + hold(`<span class="mention-pill">@${w}</span>`));
  s = esc(s);
  // Satır biçimleri
  if (!opts.inline) {
    s = s.replace(/^(#{1,3}) (.+)$/gm, (_, hs, t) => `<h${hs.length}>${t}</h${hs.length}>`);
    s = s.replace(/^-# (.+)$/gm, '<span class="sub">$1</span>');
    s = s.replace(/(^|\n)&gt; ([^\n]*)/g, '$1<blockquote>$2</blockquote>');
    s = s.replace(/<\/blockquote>\n<blockquote>/g, '<br>');
    s = s.replace(/(<\/h[123]>|<\/blockquote>)\n/g, '$1');
  }
  s = s.replace(/\*\*\*(.+?)\*\*\*/gs, '<b><i>$1</i></b>')
    .replace(/\*\*(.+?)\*\*/gs, '<b>$1</b>')
    .replace(/__(.+?)__/gs, '<u>$1</u>')
    .replace(/(^|[^\w*])\*(?!\s)(.+?)\*(?!\w)/gs, '$1<i>$2</i>')
    .replace(/(^|\W)_(?!\s)(.+?)_(?!\w)/gs, '$1<i>$2</i>')
    .replace(/~~(.+?)~~/gs, '<s>$1</s>')
    .replace(/\|\|(.+?)\|\|/gs, '<span class="spoiler">$1</span>');
  s = s.replace(/:([a-z0-9_+ğüşıöç-]{2,32}):/gi, (m, n) => { const e = EMOJI_BY_NAME.get(n.toLowerCase()); return e ? `<span class="emoji" data-tip=":${n}:">${e}</span>` : m; });
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => holds[i]);
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => holds[i]);
  return s;
}
function isJumbo(src) {
  if (!src) return false;
  const t = src.replace(/<a?:\w+:\d+>/g, 'E').replace(/\s/g, '');
  if (t.length > 60) return false;
  const stripped = t.replace(/E/g, '').replace(/\p{Extended_Pictographic}|\p{Emoji_Component}|️|‍|\p{Regional_Indicator}/gu, '');
  return stripped.length === 0 && t.length > 0;
}
function plainPreview(src, ctx) { const d = document.createElement('div'); d.innerHTML = renderMarkdown(src, ctx, { inline: true }); return d.textContent; }
