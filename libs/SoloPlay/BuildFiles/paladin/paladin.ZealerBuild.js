/**
*  @filename    paladin.ZealerBuild.js
*  @author      theBGuy
*  @desc        Zeal + Fanaticism based final build
*
*/

const finalBuild = {
	caster: false,
	skillstab: sdk.skills.tabs.PalaCombat,
	wantedskills: [sdk.skills.Zeal, sdk.skills.Fanaticism],
	usefulskills: [sdk.skills.HolyShield, sdk.skills.ResistFire, sdk.skills.ResistLightning],
	precastSkills: [sdk.skills.HolyShield],
	mercDiff: sdk.difficulty.Nightmare,
	mercAct: 2,
	mercAuraWanted: "Holy Freeze",
	stats: [
		["strength", 103], ["dexterity", 136], ["vitality", 300],
		["dexterity", "block"], ["vitality", "all"]
	],
	skills: [
		[sdk.skills.Fanaticism, 20],
		[sdk.skills.Sacrifice, 20],
		[sdk.skills.Salvation, 1],
		[sdk.skills.Redemption, 1],
		[sdk.skills.Zeal, 10],
		[sdk.skills.HolyShield, 15], // lvl 74 w/o quest skill pts
		[sdk.skills.ResistLightning, 10, false],
		[sdk.skills.ResistFire, 10, false],
		[sdk.skills.ResistCold, 10, false],
	],
	autoEquipTiers: [ // autoequip final gear
		// Weapon - Grief
		"[type] == sword && [flag] == runeword # [ias] >= 30 && [itemdeadlystrike] == 20 && [passivepoispierce] >= 20 # [tier] == 100000",
		// Final Helm - Upp'ed Vamp Gaze
		"[name] == bonevisage && [quality] == unique && [flag] != ethereal # [enhanceddefense] >= 100 && [lifeleech] >= 6 # [tier] == 100000 + tierscore(item)",
		// Helm -Vamp Gaze
		"[name] == grimhelm && [quality] == unique && [flag] != ethereal # [enhanceddefense] >= 100 # [tier] == 100000 + tierscore(item)",
		// Belt - TGods
		"[name] == warbelt && [quality] == unique && [flag] != ethereal # [enhanceddefense] >= 160 # [tier] == 110000 + tierscore(item)",
		// Boots - Gore Rider
		"[name] == warboots && [quality] == unique && [flag] != ethereal # [enhanceddefense] >= 160 # [tier] == 110000 + tierscore(item)",
		// Armor - Fortitude
		"[type] == armor && [flag] != ethereal && [flag] == runeword # [enhanceddefense] >= 200 && [enhanceddamage] >= 300 # [tier] == 110000",
		// Final Shield - Exile
		"[type] == auricshields && [flag] == runeword # [defianceaura] >= 13 # [tier] == 110000",
		// Shield - HoZ
		"[name] == gildedshield && [quality] == unique && [flag] != ethereal # [enhanceddefense] >= 150 # [tier] == 100000 + tierscore(item)",
		// Gloves - Laying of Hand's
		"[name] == bramblemitts && [quality] == set && [flag] != ethereal # [ias] >= 20 # [tier] == 110000",
		// Amulet - Highlords
		"[type] == amulet && [quality] == unique # [lightresist] == 35 # [tier] == 100000",
		// Final Rings - Perfect Raven Frost & Bul-Kathos' Wedding Band
		"[type] == ring && [quality] == unique # [dexterity] == 20 && [tohit] == 250 # [tier] == 110000",
		"[type] == ring && [quality] == unique # [maxstamina] == 50 && [lifeleech] == 5 # [tier] == 110000",
		// Rings - Raven Frost && Bul-Kathos' Wedding Band
		"[type] == ring && [quality] == unique # [dexterity] >= 15 && [tohit] >= 150 # [tier] == 100000",
		"[type] == ring && [quality] == unique # [maxstamina] == 50 && [lifeleech] >= 3 # [tier] == 100000",
		// Switch - CTA
		"[minimumsockets] >= 5 && [flag] == runeword # [plusskillbattleorders] >= 1 # [secondarytier] == 100000",
		// Merc Final Armor - Fortitude
		"[type] == armor && [flag] == runeword # [enhanceddefense] >= 200 && [enhanceddamage] >= 300 # [merctier] == 100000",
		// Merc Armor - Treachery
		"[type] == armor && [flag] == runeword # [ias] == 45 && [coldresist] == 30 # [merctier] == 50000 + mercscore(item)",
		// Merc Final Helmet - Eth Andy's
		"[name] == demonhead && [quality] == unique && [flag] == ethereal # [strength] >= 25 && [enhanceddefense] >= 100 # [merctier] == 50000 + mercscore(item)",
		// Merc Helmet - Andy's
		"[name] == demonhead && [quality] == unique && [flag] != ethereal # [strength] >= 25 && [enhanceddefense] >= 100 # [merctier] == 40000 + mercscore(item)",
	],

	charms: {
		ResLife: {
			max: 6,
			have: [],
			classid: sdk.items.SmallCharm,
			stats: function (check) {
				return (!check.unique && check.classid === this.classid && check.allRes === 5 && check.getStat(sdk.stats.MaxHp) === 20);
			}
		},

		ResMf: {
			max: 2,
			have: [],
			classid: sdk.items.SmallCharm,
			stats: function (check) {
				return (!check.unique && check.classid === this.classid && check.allRes === 5 && check.getStat(sdk.stats.MagicBonus) === 7);
			}
		},

		Skiller: {
			max: 2,
			have: [],
			classid: sdk.items.GrandCharm,
			stats: function (check) {
				return (!check.unique && check.classid === this.classid && check.getStat(sdk.stats.AddSkillTab, sdk.skills.tabs.PalaCombat) === 1
					&& check.getStat(sdk.stats.MaxHp) >= 40);
			}
		},
	},

	AutoBuildTemplate: {
		1:	{
			Update: function () {
				Config.AttackSkill = [-1, sdk.skills.Zeal, sdk.skills.Fanaticism, sdk.skills.Zeal, sdk.skills.Fanaticism, -1, -1];
				Config.LowManaSkill = [-1, -1];
				Config.BeltColumn = ["hp", "hp", "mp", "rv"];
				SetUp.belt();
			}
		},
	},

	respec: function () {
		if (me.classic) {
			return me.charlvl >= 75 && me.diablo;
		} else {
			return me.checkItem({name: sdk.locale.items.Grief, itemtype: sdk.items.type.Sword}).have;
		}
	},

	active: function () {
		return this.respec() && me.getSkill(sdk.skills.Fanaticism, sdk.skills.subindex.HardPoints) === 20;
	},
};
