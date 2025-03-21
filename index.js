// 必要なライブラリを読み込む
const {Client, Events, GatewayIntentBits} = require('discord.js');
const toml = require('toml');
const fs = require('fs');
require('dotenv').config();

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
const introduction_channel_id = config.verification.introduction_channel_id;
const role_id = config.verification.role_id;
const keyword = config.verification.keyword;

// 正規表現を作成
const regex = new RegExp(keyword);

// ロールを保存する変数
let role = null;

// メッセージが送信されたときの処理
client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;
    if (message.channelId === introduction_channel_id) {
        // 正規表現を作成
        if (regex.test(message.content)) {
            // メンバーに役職を付与
            const member = message.member;
            if (!member) {
                console.error('ロールを付与するメンバーが見つかりません:', message.author.tag);
                return;
            }
            try {
                await member.roles.add(role);
            } catch (error) {
                console.error('役職の付与中にエラーが発生しました:', error);
            }
        } else {
            console.log('キーワードがメッセージに含まれていません。');
        }
    }
});

// Botが起動したときの処理
client.once(Events.ClientReady, readyClient => {
    console.log(`${readyClient.user.tag}でログインしました。`);
    // ロールを取得
    const guild = readyClient.guilds.cache.first();
    role = guild.roles.cache.get(role_id);
    if (!role) {
        console.error('ロールが見つかりません。');
    }
});

// Botを起動
client.login(process.env.DISCORD_BOT_TOKEN).catch(error => {
    console.error('ログイン中にエラーが発生しました:', error);
});