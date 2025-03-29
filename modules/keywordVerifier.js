// keywordVerifier.js
// index.jsから呼び出される
// 合言葉認証を行うモジュール

module.exports = {
    /**
     * @param {import('discord.js').Message} message - メッセージオブジェクト
     * @param {RegExp} regex_keyword - 合言葉の正規表現
     * @param {import('discord.js').Role} role - 付与する役職
     * @param {string} introduction_channel_id - 合言葉を送信するチャンネルのID
     * @param {string} dm_message_wrong - 合言葉が間違っている場合のDMメッセージ
     * @param {string} dm_message_correct - 合言葉が正しい場合のDMメッセージ
     */
    validateKeyword: async (message, regex_keyword, role, introduction_channel_id, dm_message_wrong, dm_message_correct) => {
        if (role == null) {
            console.warn('ロールが取得されていません。');
            return;
        }
        if (message.channelId === introduction_channel_id) {
            let dm_message;
            if (regex_keyword.test(message.content)) {
                // メンバーに役職を付与
                const member = message.member;
                if (member == null) {
                    console.error('ロールを付与するメンバーが見つかりません:', message.author.tag);
                    return;
                }
                try {
                    await member.roles.add(role);
                } catch (error) {
                    console.error('役職の付与中にエラーが発生しました:', error);
                }
                dm_message = dm_message_correct.replace('{name}', message.author.displayName);
            } else {
                console.log('合言葉が一致しません:', message.content);
                dm_message = dm_message_wrong.replace('{name}', message.author.displayName);
            }
            try {
                await message.author.send(dm_message);
            } catch (error) {
                console.error('DMの送信中にエラーが発生しました:', error);
            }
        }
    }
}
