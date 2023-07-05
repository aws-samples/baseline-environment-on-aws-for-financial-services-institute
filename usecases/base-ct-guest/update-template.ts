/**
 * AFCに登録するCloudFormationテンプレートから下記のセクションを削除する
 * - Rules
 * - Parameters
 */

import * as fs from 'fs';

const cfnTemplateFilePath = './governance-base-blueprint.json';

//ファイル読込
const cfnTemplate = JSON.parse(fs.readFileSync(cfnTemplateFilePath).toString());

//キーの削除
delete cfnTemplate['Rules'];
delete cfnTemplate['Parameters'];

//ファイル出力
fs.writeFileSync(cfnTemplateFilePath, JSON.stringify(cfnTemplate, null, 2));
