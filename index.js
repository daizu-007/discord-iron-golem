// index.js
// このファイルを実行する

// 必要なライブラリを読み込む
const {Client, Events, GatewayIntentBits} = require('discord.js');
const toml = require('toml');
const fs = require('fs');
const keywordVerifier = require('./modules/keywordVerifier.js');

// クライアントを作成
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessages,
    ]
});

// Configを読み込む
let config;
try {
    const configContent = fs.readFileSync('./config.toml', 'utf8');
    config = toml.parse(configContent);
} catch (error) {
    console.error('Configの読み込み中にエラーが発生しました:', error);
}

const token = config.general.token;
const log_channel_id = config.general.log_channel_id;
const introduction_channel_id = config.verification.introduction_channel_id;
const role_id = config.verification.role_id;
const keyword = config.verification.keyword;
const dm_message_wrong = config.verification.dm_message_wrong;
const dm_message_correct = config.verification.dm_message_correct;

// 正規表現を作成
const regex_keyword = new RegExp(keyword);

// ロールを保存する変数
let role = null;
// ログチャンネルを保存する変数
let log_channel = null;

// メッセージが送信されたときの処理
client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return; // Botのメッセージは無視
    if (!message.guild) return; // DMの場合は無視
    // メッセージを処理(keywordVerifier.js)
    await keywordVerifier.validateKeyword(
        message,
        regex_keyword,
        role,
        introduction_channel_id,
        dm_message_wrong,
        dm_message_correct,
        log_channel
    );
});

// Botが起動したときの処理
client.once(Events.ClientReady, readyClient => {
    console.log(`${readyClient.user.tag}でログインしました。`);
    // ロールを取得
    const guild = readyClient.guilds.cache.first();
    role = guild.roles.cache.get(role_id);
    log_channel = guild.channels.cache.get(log_channel_id);
    if (log_channel == null) {
        console.error('ログチャンネルが見つかりません。');
    }
    if (role == null) {
        console.error('ロールが見つかりません。');
    }
});

// Botを起動
client.login(token).catch(error => {
    console.error('ログイン中にエラーが発生しました:', error);
});