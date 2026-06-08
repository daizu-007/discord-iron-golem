// keywordVerifier.ts
// index.tsから呼び出される
// 合言葉認証を行うモジュール

import type {Message, Role, TextChannel} from 'discord.js';

/**
 * @param message - メッセージオブジェクト
 * @param regex_keyword - 合言葉の正規表現
 * @param role - 付与する役職
 * @param introduction_channel_id - 合言葉を送信するチャンネルのID
 * @param dm_message_wrong - 合言葉が間違っている場合のDMメッセージ
 * @param dm_message_correct - 合言葉が正しい場合のDMメッセージ
 * @param log_channel - ログチャンネル
 */
export async function validateKeyword(
    message: Message,
    regex_keyword: RegExp,
    role: Role | null,
    introduction_channel_id: string,
    dm_message_wrong: string,
    dm_message_correct: string,
    log_channel: TextChannel | null
) {
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
                    if (log_channel) {
                        try {
                            await log_channel.send(`**${message.author.tag}** が合言葉を正しく入力しました。`);
                        }
                        catch (error) {
                            console.error('ログチャンネルへのメッセージ送信中にエラーが発生しました:', error);
                        }
                    }
                } catch (error) {
                    console.error('役職の付与中にエラーが発生しました:', error);
                }
                dm_message = dm_message_correct.replace('{name}', message.author.displayName);
            } else {
                console.log('合言葉が一致しません:', message.content);
                dm_message = dm_message_wrong.replace('{name}', message.author.displayName);
                if (log_channel) {
                    try {
                        await log_channel.send(`**${message.author.tag}** が合言葉を間違えて入力しました。`);
                    } catch (error) {
                        console.error('ログチャンネルへのメッセージ送信中にエラーが発生しました:', error);
                    }
                }
            }
            try {
                await message.author.send(dm_message);
            } catch (error) {
                console.error('DMの送信中にエラーが発生しました:', error);
            }
        }
}
