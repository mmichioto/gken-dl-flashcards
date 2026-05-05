#!/usr/bin/env python3
"""G検定フラッシュカード CLIプレイヤー

使い方:
  python3 flashcard.py                       # 全カードからランダム10枚
  python3 flashcard.py --domain DL概要       # ドメイン絞り込み
  python3 flashcard.py --priority high       # 優先度絞り込み
  python3 flashcard.py --count 20            # 出題数指定
  python3 flashcard.py --review              # 前回間違えたカードのみ
  python3 flashcard.py --list-domains        # ドメイン一覧
  python3 flashcard.py --stats               # 学習統計
  python3 flashcard.py --export-anki         # Anki用CSV出力
"""
import argparse
import json
import os
import random
import sys
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
CARDS_PATH = BASE_DIR / "cards.json"
PROGRESS_PATH = BASE_DIR / "progress.json"

# ANSI 色コード
class C:
    R = "\033[0m"      # reset
    BOLD = "\033[1m"
    GREEN = "\033[32m"
    RED = "\033[31m"
    YELLOW = "\033[33m"
    CYAN = "\033[36m"
    MAGENTA = "\033[35m"
    GRAY = "\033[90m"


def load_cards():
    if not CARDS_PATH.exists():
        print(f"{C.RED}cards.json が見つからん: {CARDS_PATH}{C.R}")
        sys.exit(1)
    with open(CARDS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_progress():
    if not PROGRESS_PATH.exists():
        return {"sessions": [], "card_stats": {}}
    with open(PROGRESS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_progress(progress):
    with open(PROGRESS_PATH, "w", encoding="utf-8") as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)


def list_domains(deck):
    domains = sorted({c["domain"] for c in deck["cards"]})
    print(f"{C.BOLD}■ ドメイン一覧（カード数）{C.R}")
    for d in domains:
        n = sum(1 for c in deck["cards"] if c["domain"] == d)
        print(f"  - {d:20s} {n}枚")


def show_stats(deck, progress):
    total = len(deck["cards"])
    stats = progress.get("card_stats", {})
    seen = sum(1 for v in stats.values() if v.get("attempts", 0) > 0)
    correct = sum(v.get("correct", 0) for v in stats.values())
    attempts = sum(v.get("attempts", 0) for v in stats.values())
    rate = (correct / attempts * 100) if attempts else 0
    print(f"{C.BOLD}■ 学習統計{C.R}")
    print(f"  総カード数: {total}枚")
    print(f"  接した枚数: {seen}枚 ({seen/total*100:.0f}%)")
    print(f"  累計正答率: {rate:.1f}% ({correct}/{attempts})")

    # ドメイン別集計
    by_domain = {}
    for card in deck["cards"]:
        s = stats.get(card["id"], {})
        d = card["domain"]
        if d not in by_domain:
            by_domain[d] = {"total": 0, "correct": 0, "attempts": 0}
        by_domain[d]["total"] += 1
        by_domain[d]["correct"] += s.get("correct", 0)
        by_domain[d]["attempts"] += s.get("attempts", 0)
    print(f"\n{C.BOLD}■ ドメイン別正答率{C.R}")
    for d, v in sorted(by_domain.items()):
        r = (v["correct"] / v["attempts"] * 100) if v["attempts"] else 0
        bar_n = int(r / 5)
        bar = "█" * bar_n + "·" * (20 - bar_n)
        print(f"  {d:18s} {bar} {r:5.1f}%  ({v['correct']}/{v['attempts']} attempts)")


def filter_cards(deck, args, progress):
    pool = list(deck["cards"])
    if args.domain:
        pool = [c for c in pool if c["domain"] == args.domain]
    if args.priority:
        pool = [c for c in pool if c.get("priority") == args.priority]
    if args.tag:
        pool = [c for c in pool if args.tag in c.get("tags", [])]
    if args.review:
        # 直近で間違えたカードのみ
        wrong_ids = {
            cid for cid, s in progress.get("card_stats", {}).items()
            if s.get("attempts", 0) > 0 and s.get("last_correct") is False
        }
        pool = [c for c in pool if c["id"] in wrong_ids]
    return pool


def quiz_session(deck, args, progress):
    pool = filter_cards(deck, args, progress)
    if not pool:
        print(f"{C.YELLOW}該当するカードなし{C.R}")
        return
    random.shuffle(pool)
    pool = pool[:args.count]

    print(f"\n{C.BOLD}{C.CYAN}=== G検定フラッシュカード ==={C.R}")
    print(f"出題数: {len(pool)}枚\n")

    correct_count = 0
    session = {
        "started_at": datetime.now().isoformat(timespec="seconds"),
        "results": []
    }
    stats = progress.setdefault("card_stats", {})

    for i, card in enumerate(pool, 1):
        print(f"{C.GRAY}[{i}/{len(pool)}] {card['domain']} / {card.get('category','')} / 優先度: {card.get('priority','')}{C.R}")
        print(f"{C.BOLD}■ 用語: {card['term']}{C.R}")
        print(f"{C.CYAN}Q: {card['front']}{C.R}")
        try:
            input(f"{C.GRAY}（Enter で答えを表示）{C.R}")
        except (EOFError, KeyboardInterrupt):
            print("\n中断")
            break
        print(f"{C.GREEN}A: {card['back']}{C.R}")
        if card.get("trap"):
            print(f"{C.YELLOW}⚠️ ひっかけ: {card['trap']}{C.R}")
        if card.get("related"):
            print(f"{C.MAGENTA}関連: {', '.join(card['related'])}{C.R}")
        if card.get("source"):
            print(f"{C.GRAY}出典: {card['source']}{C.R}")
        try:
            ans = input(f"\n正解？ ({C.GREEN}y{C.R}=正解 / {C.RED}n{C.R}=不正解 / s=スキップ): ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\n中断")
            break
        is_correct = ans == "y"
        if ans == "s":
            print(f"{C.GRAY}スキップ{C.R}\n")
            continue
        # 統計更新
        cstat = stats.setdefault(card["id"], {"attempts": 0, "correct": 0})
        cstat["attempts"] += 1
        if is_correct:
            cstat["correct"] += 1
            correct_count += 1
            print(f"{C.GREEN}✓ 正解！{C.R}\n")
        else:
            print(f"{C.RED}✗ 不正解。次回また出るで{C.R}\n")
        cstat["last_correct"] = is_correct
        cstat["last_seen"] = datetime.now().isoformat(timespec="seconds")
        session["results"].append({"id": card["id"], "correct": is_correct})

    if session["results"]:
        n = len(session["results"])
        print(f"{C.BOLD}=== 結果 ==={C.R}")
        print(f"正解: {correct_count}/{n} ({correct_count/n*100:.1f}%)")
        progress.setdefault("sessions", []).append(session)
        save_progress(progress)
        print(f"{C.GRAY}進捗を {PROGRESS_PATH.name} に保存した{C.R}")


def export_anki(deck):
    """Anki インポート用のTSV書き出し（フィールド: 表, 裏, タグ）"""
    out = BASE_DIR / "anki_import.tsv"
    with open(out, "w", encoding="utf-8") as f:
        for card in deck["cards"]:
            front = f"{card['term']}<br><br>{card['front']}"
            back = card["back"]
            if card.get("trap"):
                back += f"<br><br>⚠️ ひっかけ: {card['trap']}"
            if card.get("related"):
                back += f"<br>関連: {', '.join(card['related'])}"
            tags = " ".join(card.get("tags", []) + [card["domain"], card.get("priority", "")])
            # 改行とタブはエスケープ
            front = front.replace("\t", " ").replace("\n", "<br>")
            back = back.replace("\t", " ").replace("\n", "<br>")
            f.write(f"{front}\t{back}\t{tags}\n")
    print(f"Anki TSV出力: {out}")


def main():
    parser = argparse.ArgumentParser(description="G検定フラッシュカード")
    parser.add_argument("--domain", help="ドメイン絞り込み（例: DL概要）")
    parser.add_argument("--priority", choices=["high", "mid", "low"], help="優先度絞り込み")
    parser.add_argument("--tag", help="タグ絞り込み")
    parser.add_argument("--count", type=int, default=10, help="出題数（デフォルト10）")
    parser.add_argument("--review", action="store_true", help="前回間違えたカードのみ")
    parser.add_argument("--list-domains", action="store_true", help="ドメイン一覧")
    parser.add_argument("--stats", action="store_true", help="学習統計表示")
    parser.add_argument("--export-anki", action="store_true", help="Anki用TSV出力")
    args = parser.parse_args()

    deck = load_cards()
    progress = load_progress()

    if args.list_domains:
        list_domains(deck)
        return
    if args.stats:
        show_stats(deck, progress)
        return
    if args.export_anki:
        export_anki(deck)
        return

    quiz_session(deck, args, progress)


if __name__ == "__main__":
    main()
