---
inclusion: manual
---

# Release Checklist

Before tagging and packaging a release, verify the following:

1. `package.json` の `version` がリリースバージョンと一致していること
2. `CHANGELOG.md` にリリースバージョンのエントリがあること
3. `npm run test:ci` が全パスすること
4. `npm run build` が成功すること
5. Roadmap の実装済み項目が更新されていること
6. demo.md に新機能のサンプルが追加されていること

## Tag & Package

```bash
git checkout main
git merge feature/xxx --no-ff -m "Merge feature/xxx: description"

# version確認（package.jsonとタグが一致すること）
grep '"version"' package.json

git tag -a vX.Y.Z -m "vX.Y.Z: summary"
npm run package
```

## よくあるミス

- package.json の version を更新し忘れてタグを打つ → タグ打ち直しが必要になる
- CHANGELOG にエントリを書き忘れる
- examples/ のPDFサンプルを更新し忘れる
