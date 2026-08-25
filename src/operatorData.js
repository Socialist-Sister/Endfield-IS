const percentSkill = (name, facility, category, label, low, high, unlock = 1, sign = "+") => ({
  name,
  facility,
  category,
  tiers: [
    { promotion: unlock, value: low, description: `${label} ${sign}${low}%` },
    { promotion: unlock + 2, value: high, description: `${label} ${sign}${high}%` },
  ],
});

const clueSkill = (name, clue, unlock = 1) => ({
  name,
  facility: "会客室",
  category: "clue-special",
  clue,
  tiers: [
    { promotion: unlock, value: 0, biasLevel: 1, description: `线索${clue}概率小幅提升` },
    { promotion: unlock + 2, value: 0, biasLevel: 2, description: `线索${clue}概率提升` },
  ],
});

const operator = (id, name, rarity, skills) => ({ id, name, rarity, skills });

export const FACILITIES = ["制造舱", "培养舱", "会客室", "总控中枢"];

export const OPERATORS = [
  operator("arcane", "诀", 6, [
    percentSkill("摘山煮海", "培养舱", "rare-mineral", "矿物质料培养", 20, 30),
    percentSkill("多识草木", "培养舱", "vitrified", "晶植质料培养", 20, 30, 2),
  ]),
  operator("liino", "梨诺", 6, [
    percentSkill("偶像的热忱", "会客室", "mood-drop", "心情消耗", 14, 18, 1, "-"),
    percentSkill("演出余韵", "总控中枢", "mood-regen", "全员心情恢复", 12, 16, 2),
  ]),
  operator("camille", "卡缪", 6, [
    percentSkill("血液玻璃成像", "培养舱", "vitrified", "晶植质料培养", 20, 30),
    percentSkill("阿加什机械学手册", "制造舱", "operator-exp", "干员经验效率", 20, 30, 2),
  ]),
  operator("mifu", "弭弗", 6, [
    clueSkill("暗桩眼线", 3),
    percentSkill("草药偏方", "培养舱", "fungal", "菌类质料培养", 20, 30, 2),
  ]),
  operator("zhuang", "庄方宜", 6, [
    percentSkill("总督经验", "制造舱", "mood-drop", "心情消耗", 14, 18, 1, "-"),
    percentSkill("天师池冥想", "制造舱", "operator-exp", "干员经验效率", 20, 30, 2),
  ]),
  operator("rossi", "洛茜", 6, [
    percentSkill("氏族礼仪", "会客室", "mood-drop", "心情消耗", 14, 18, 1, "-"),
    percentSkill("狩猎气息", "会客室", "clue-rate", "线索收集效率", 20, 30, 2),
  ]),
  operator("tangtang", "汤汤", 6, [
    percentSkill("大当家", "培养舱", "mood-drop", "心情消耗", 14, 18, 1, "-"),
    percentSkill("河流的女儿", "培养舱", "vitrified", "晶植质料培养", 20, 30, 2),
  ]),
  operator("laevatain", "莱万汀", 6, [
    percentSkill("记忆熔炉", "制造舱", "operator-exp", "干员经验效率", 20, 30),
    percentSkill("不熄之焰", "制造舱", "mood-drop", "心情消耗", 14, 18, 2, "-"),
  ]),
  operator("yvonne", "伊冯", 6, [
    percentSkill("菌类颜料提取", "培养舱", "fungal", "菌类质料培养", 20, 30),
    percentSkill("时尚达人", "培养舱", "mood-drop", "心情消耗", 14, 18, 2, "-"),
  ]),
  operator("gilberta", "洁尔佩塔", 6, [
    percentSkill("信使文件处理", "制造舱", "mood-drop", "心情消耗", 14, 18, 1, "-"),
    percentSkill("信使武备精通", "制造舱", "weapon-exp", "武器经验效率", 20, 30, 2),
  ]),
  operator("ardelia", "艾尔黛拉", 6, [
    percentSkill("大地见闻", "会客室", "clue-rate", "线索收集效率", 20, 30),
    percentSkill("多莉先生的游戏", "会客室", "mood-drop", "心情消耗", 14, 18, 2, "-"),
  ]),
  operator("ember", "余烬", 6, [
    percentSkill("北地特训", "制造舱", "operator-exp", "干员经验效率", 20, 30),
    clueSkill("同袍相系", 4, 2),
  ]),
  operator("last-rite", "别礼", 6, [
    percentSkill("墓地园艺", "培养舱", "vitrified", "晶植质料培养", 20, 30),
    clueSkill("王庭盛名", 7, 2),
  ]),
  operator("lifeng", "黎风", 6, [
    percentSkill("少年意气", "总控中枢", "mood-regen", "全员心情恢复", 12, 16),
    clueSkill("小大人", 3, 2),
  ]),
  operator("pogranichnik", "骏卫", 6, [
    percentSkill("武器磨砺", "制造舱", "weapon-exp", "武器经验效率", 20, 30),
    percentSkill("士气鼓舞", "制造舱", "mood-drop", "心情消耗", 14, 18, 2, "-"),
  ]),
  operator("perlica", "佩丽卡", 5, [
    percentSkill("监督", "总控中枢", "mood-regen", "全员心情恢复", 8, 12),
    percentSkill("协议再分配", "制造舱", "weapon-exp", "武器经验效率", 20, 30, 2),
  ]),
  operator("chen", "陈千语", 5, [
    percentSkill("名剑选评", "制造舱", "weapon-exp", "武器经验效率", 10, 20),
    percentSkill("琢玉", "培养舱", "rare-mineral", "矿物质料培养", 20, 30, 2),
  ]),
  operator("alesh", "阿列什", 5, [
    percentSkill("闲钓", "总控中枢", "mood-regen", "全员心情恢复", 8, 12),
    clueSkill("钓客情报网", 1, 2),
  ]),
  operator("arclight", "弧光", 5, [
    percentSkill("荒野之刃", "制造舱", "weapon-exp", "武器经验效率", 10, 20),
    clueSkill("汉娜传统", 6, 2),
  ]),
  operator("avywenna", "艾维文娜", 5, [
    percentSkill("居家顾问", "总控中枢", "mood-regen", "全员心情恢复", 8, 12),
    clueSkill("信使的秘密", 2, 2),
  ]),
  operator("dapan", "大潘", 5, [
    percentSkill("山珍野味大厨", "培养舱", "fungal", "菌类质料培养", 10, 20),
    percentSkill("处世智慧", "总控中枢", "mood-regen", "全员心情恢复", 12, 16, 2),
  ]),
  operator("snowshine", "昼雪", 5, [
    percentSkill("救援者的坚持", "制造舱", "mood-drop", "心情消耗", 10, 14, 1, "-"),
    percentSkill("乐天派", "总控中枢", "mood-regen", "全员心情恢复", 12, 16, 2),
  ]),
  operator("wulfgard", "狼卫", 5, [
    percentSkill("狼群技巧", "制造舱", "operator-exp", "干员经验效率", 10, 20),
    percentSkill("荒野诀窍", "培养舱", "rare-mineral", "矿物质料培养", 20, 30, 2),
  ]),
  operator("xaihi", "赛希", 5, [
    percentSkill("标准化脚本", "制造舱", "operator-exp", "干员经验效率", 10, 20),
    clueSkill("低语会谈", 5, 2),
  ]),
  operator("akekuri", "秋栗", 4, [
    percentSkill("咖啡还是茶", "制造舱", "mood-drop", "心情消耗", 10, 14, 1, "-"),
    percentSkill("破冰者", "会客室", "mood-drop", "心情消耗", 14, 18, 2, "-"),
  ]),
  operator("antal", "安塔尔", 4, [
    percentSkill("实验施术单元", "制造舱", "weapon-exp", "武器经验效率", 10, 20),
    percentSkill("谐音研究", "培养舱", "mood-drop", "心情消耗", 14, 18, 2, "-"),
  ]),
  operator("catcher", "卡契尔", 4, [
    percentSkill("沉默照料", "总控中枢", "mood-regen", "全员心情恢复", 8, 12),
    percentSkill("脚踏实地", "培养舱", "mood-drop", "心情消耗", 14, 18, 2, "-"),
  ]),
  operator("estella", "埃特拉", 4, [
    percentSkill("碎片化休息", "总控中枢", "mood-regen", "全员心情恢复", 8, 12),
    percentSkill("监听频段", "会客室", "clue-rate", "线索收集效率", 20, 30, 2),
  ]),
  operator("fluorite", "萤石", 4, [
    percentSkill("荒野行者", "培养舱", "rare-mineral", "矿物质料培养", 10, 20),
    percentSkill("情绪解读", "总控中枢", "mood-regen", "全员心情恢复", 12, 16, 2),
  ]),
];

export function getActiveSkill(skill, promotion) {
  return [...skill.tiers].reverse().find((tier) => promotion >= tier.promotion) ?? null;
}

export function sortSkillsForDisplay(skills) {
  const displayOrder = (skill) => {
    if (skill.category === "mood-drop") return 2;
    if (skill.category === "mood-regen") return 1;
    return 0;
  };
  return [...skills].sort((left, right) => displayOrder(left) - displayOrder(right));
}

export function getOperatorSkillSummary(operatorData, promotion) {
  return sortSkillsForDisplay(operatorData.skills.map((skill) => ({
    ...skill,
    activeTier: getActiveSkill(skill, promotion),
  })));
}
