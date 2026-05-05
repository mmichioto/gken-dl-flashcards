# 🎴 G検定 フラッシュカード（DL系3兄弟・追い込み版）

[![Python](https://img.shields.io/badge/python-3.7+-blue.svg)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Cards](https://img.shields.io/badge/cards-80-green.svg)](cards.json)

JDLA G検定（ジェネラリスト検定）の試験対策用 CLI フラッシュカード。模試結果で弱点が判明した **DL概要・DL応用例・DL要素技術** の3ドメインを80枚に集中圧縮。Python標準ライブラリのみで動作するので、Claude Code・ターミナル・隙間時間で軽快に動く。

---

## 📚 収録内容（全80枚）

| ドメイン | 枚数 | 主な内容 |
|---|---:|---|
| **DL概要** | 28枚 | 強化学習（DQN拡張・AlphaGo・Sim2Real）、自己教師あり学習、生成モデル、XAI |
| **DL応用例** | 28枚 | CNN系、物体検出、セグメンテーション、RNN/LSTM、Transformer、NLP |
| **DL要素技術** | 24枚 | 誤差逆伝播、活性化関数、最適化、正則化、ドロップアウト、評価指標 |

各カードに含まれるフィールド：

| フィールド | 説明 |
|---|---|
| `term` | 用語名 |
| `front` | 問い |
| `back` | 答え（要点に絞った説明） |
| `trap` | ⚠️ 真逆ワードや引っかけパターン |
| `related` | 関連用語（横断学習を促進） |
| `source` | 出典（復習①②、カンペDB等） |
| `priority` | high / mid / low |

---

## 🚀 クイックスタート

```bash
# リポジトリを取得
git clone <あなたのリポジトリURL>
cd G検定_フラッシュカード

# すぐ実行（依存パッケージなし）
python3 flashcard.py
```

Python 3.7 以上で動作確認済み。追加パッケージのインストール不要。

---

## 🎮 使い方

### 基本コマンド

```bash
# 全ドメインからランダム10枚
python3 flashcard.py

# DL概要だけ20枚
python3 flashcard.py --domain DL概要 --count 20

# 重要度高のみ集中
python3 flashcard.py --priority high

# 前回間違えたカードのみ復習
python3 flashcard.py --review

# 学習統計を表示
python3 flashcard.py --stats

# ドメイン一覧
python3 flashcard.py --list-domains

# Anki用CSVを書き出し
python3 flashcard.py --export-anki
```

### 1セッションの流れ

1. 用語・ドメイン・優先度・問いが表示される
2. **Enter** で答えを表示（trap・関連用語・出典も併記）
3. **y** = 正解 / **n** = 不正解 / **s** = スキップ
4. 全カード終了後、結果と進捗が `progress.json` に保存される
5. 次回 `--review` で間違えたカードだけを再出題できる

### サンプル出力

[`docs/サンプル出力.md`](docs/サンプル出力.md) を参照。

---

## 📅 試験までのおすすめ消化ペース

| 日 | コマンド例 |
|---|---|
| Day 1 | `python3 flashcard.py --domain DL概要 --count 28` |
| Day 2 | `python3 flashcard.py --domain DL応用例 --count 28` |
| Day 3 | `python3 flashcard.py --domain DL要素技術 --count 24` |
| Day 4 | `python3 flashcard.py --priority high` ＋ `--review` |
| 試験当日朝 | `python3 flashcard.py --priority high --count 20` |

---

## 🎯 trap欄つきカード（ひっかけ対策）

合計14枚に `trap` 欄が付与されとる。試験で出題されたら **「真逆ワードに警戒」** を脳内で唱える習慣化を。代表例：

| カードID | 用語 | trap |
|---|---|---|
| `DL-OV-009` | ノイジーネットワーク | 「固定」と書かれていたら真逆 |
| `DL-OV-014` | AlphaGo | 囲碁専用、将棋・チェスはAlphaZero |
| `DL-OV-018` | ドメインランダマイゼーション | Reality Gap完全解消ではない |
| `DL-OV-020` | 自己教師あり学習 | ラベルなし≠教師なし |
| `DL-AP-016` | 形態素解析 | 構文解析より先 |
| `DL-AP-018` | BoW | 「順序を考慮しない」が本質 |

---

## 🛠 ファイル構成

```
G検定_フラッシュカード/
├── flashcard.py        # CLIプレイヤー
├── cards.json          # カードデータ（80枚）
├── progress.json       # 学習進捗（自動生成、.gitignore対象）
├── README.md           # このファイル
├── LICENSE             # MIT
├── .gitignore
├── requirements.txt
└── docs/
    └── サンプル出力.md
```

---

## ➕ カードの追加・編集

`cards.json` をテキストエディタで開いて、`cards` 配列にオブジェクトを追加するだけ。フォーマットは既存カードを参考に。`id` は重複しないように `DL-XX-NNN` 形式（XX=OV/AP/EL）。

```json
{
  "id": "DL-OV-029",
  "domain": "DL概要",
  "category": "新カテゴリ",
  "priority": "mid",
  "tags": ["タグ1", "タグ2"],
  "term": "用語名",
  "front": "問いの文",
  "back": "答えの説明",
  "trap": "ひっかけがあれば",
  "related": ["関連用語1", "関連用語2"],
  "source": "出典"
}
```

---

## 📦 Anki にエクスポート

モバイル端末で勉強したい場合：

```bash
python3 flashcard.py --export-anki
```

`anki_import.tsv` が生成されるので、Anki デスクトップアプリで「ファイル→読み込み」から取り込める。Field 1: 表面（用語＋問い）、Field 2: 裏面（答え＋trap＋関連）、Field 3: タグ。

---

## 📜 ライセンス

MIT License. 詳細は [LICENSE](LICENSE) を参照。

---

## 🤝 Acknowledgments

- 模試（Udemy）・白本・公式シラバスから抽出
- 復習①（NLP3兄弟）・復習②（問題9〜15、25〜30）の論点を反映
- カンペDB（Notion）の主要用語と整合
