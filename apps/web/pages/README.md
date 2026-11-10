# Не удалять

Папка намеренно пустая. Роутинг Next.js лежит в `apps/web/app` (App Router), а слой FSD `pages` — в `src/pages`.

Без этой папки Next принял бы `src/pages` за Pages Router и попытался бы построить из слайсов FSD маршруты.
