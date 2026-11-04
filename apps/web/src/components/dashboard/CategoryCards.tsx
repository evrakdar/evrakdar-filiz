import { useState } from "react";
import type { MainCategory, SubCategory } from "@/lib/mock-data";

/** Two rows of four on a wide screen; the rest open on request. */
const VISIBLE_CATEGORIES = 8;

type CategoryCardsProps = {
  categories: MainCategory[];
  selectedCategoryId: string | null;
  selectedSubCategoryId: string | null;
  onSelectCategory: (category: MainCategory) => void;
  onSelectSubCategory: (subCategory: SubCategory) => void;
};

export function CategoryCards({
  categories,
  selectedCategoryId,
  selectedSubCategoryId,
  onSelectCategory,
  onSelectSubCategory
}: CategoryCardsProps) {
  const [showAll, setShowAll] = useState(false);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? null;
  const firstCategories = categories.slice(0, VISIBLE_CATEGORIES);
  let visibleCategories = showAll ? categories : firstCategories;

  // A chosen folder further down the list stays on the screen.
  if (!showAll && selectedCategory && !firstCategories.some((category) => category.id === selectedCategory.id)) {
    visibleCategories = [...firstCategories, selectedCategory];
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 xl:grid-cols-4">
        {visibleCategories.map((category) => {
          const isSelected = category.id === selectedCategoryId;

          return (
            <button
              key={category.id}
              onClick={() => onSelectCategory(category)}
              className={`rounded-md border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm dark:bg-zinc-900 ${
                isSelected ? "border-brand-800 shadow-sm ring-1 ring-brand-800" : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{category.title}</h3>
                <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {category.count}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{category.description}</p>
            </button>
          );
        })}
      </div>
      {categories.length > VISIBLE_CATEGORIES ? (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowAll((current) => !current)}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {showAll ? "Daha az göster" : `Tümünü gör (${categories.length})`}
          </button>
        </div>
      ) : null}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {selectedCategory ? `${selectedCategory.title} alt kategorileri` : "Alt kategoriler"}
          </h3>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {selectedCategory ? `${selectedCategory.subCategories.length} kategori` : "Ana kategori bekleniyor"}
          </span>
        </div>
        {selectedCategory ? (
          <div className="grid gap-3 md:grid-cols-3">
            {selectedCategory.subCategories.map((subCategory) => {
            const isSelected = subCategory.id === selectedSubCategoryId;

            return (
              <button
                key={subCategory.id}
                onClick={() => onSelectSubCategory(subCategory)}
                className={`rounded-md border p-4 text-left transition hover:border-brand-800 hover:bg-brand-50/50 dark:hover:bg-brand-950/30 ${
                  isSelected ? "border-brand-800 bg-brand-50 dark:bg-brand-950/30" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                }`}
              >
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{subCategory.title}</h4>
                <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{subCategory.description}</p>
              </button>
            );
            })}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Alt kategorileri görmek için önce yukarıdaki ana menü kartlarından birini seç.
          </div>
        )}
      </div>
    </section>
  );
}
