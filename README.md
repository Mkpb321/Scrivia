# Scrivia

```bash
python -m http.server 8000
```

```text
http://localhost:8000
```

## Dateien

- `index.html`
- `styles.css`
- `app.js`
- `questions.csv`

## CSV

Spalten:

```text
id,type,testament,book_id,book_name,chapter,scope,category,difficulty,question,choices,correct_answer,explanation,reference
```

Antworten in `choices` mit `||` trennen. `correct_answer` muss exakt einer Antwort aus `choices` entsprechen.
