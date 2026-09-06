import { useEffect, useState } from 'react'
import { Button, ChipGroup, FilterChip, Modal, RadioRow, SheetSection, TextButton } from '@/components'
import type { Book, SortKey } from '@/types'
import { pluralize } from '@/utils/format'
import { applyFilters, DEFAULT_FILTERS, defaultDirection, SORT_OPTIONS, type LibraryFilters } from './filter'

export interface FilterDraft {
  genres: string[]
  languages: string[]
  sort: SortKey
}

interface FilterSheetProps {
  open: boolean
  onClose: () => void
  books: Book[]
  filters: LibraryFilters
  genres: Array<{ value: string; count: number }>
  languages: Array<{ value: string; count: number }>
  onApply: (draft: FilterDraft) => void
}

const VISIBLE_GENRES = 6

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

/** "Filter & sort" bottom sheet: multi-select genre and language chips, sort radios, one CTA. */
export function FilterSheet({ open, onClose, books, filters, genres, languages, onApply }: FilterSheetProps) {
  const [draft, setDraft] = useState<FilterDraft>({ genres: filters.genres, languages: filters.languages, sort: filters.sort })
  const [showAllGenres, setShowAllGenres] = useState(false)

  // Re-seed the draft each time the sheet opens so Cancel discards edits.
  useEffect(() => {
    if (open) {
      setDraft({ genres: filters.genres, languages: filters.languages, sort: filters.sort })
      setShowAllGenres(filters.genres.some((g) => genres.findIndex((x) => x.value === g) >= VISIBLE_GENRES))
    }
  }, [open, filters.genres, filters.languages, filters.sort, genres])

  const count = applyFilters(books, { ...filters, ...draft, direction: defaultDirection(draft.sort) }).length
  const visibleGenres = showAllGenres ? genres : genres.slice(0, VISIBLE_GENRES)
  const pristine = draft.genres.length === 0 && draft.languages.length === 0 && draft.sort === DEFAULT_FILTERS.sort

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Filter & sort"
      titleAction={
        <TextButton onClick={() => setDraft({ genres: [], languages: [], sort: DEFAULT_FILTERS.sort })} disabled={pristine} style={{ fontSize: 14 }}>
          Reset
        </TextButton>
      }
      actions={
        <Button size="lg" block onClick={() => onApply(draft)}>
          Show {pluralize(count, 'book')}
        </Button>
      }
    >
      {genres.length > 0 && (
        <SheetSection label="Genre">
          <ChipGroup label="Genre">
            {visibleGenres.map((genre) => (
              <FilterChip key={genre.value} tone="accent" selected={draft.genres.includes(genre.value)} onClick={() => setDraft((d) => ({ ...d, genres: toggle(d.genres, genre.value) }))}>
                {genre.value}
              </FilterChip>
            ))}
            {!showAllGenres && genres.length > VISIBLE_GENRES && (
              <FilterChip onClick={() => setShowAllGenres(true)} aria-label={`Show ${genres.length - VISIBLE_GENRES} more genres`}>
                More…
              </FilterChip>
            )}
          </ChipGroup>
        </SheetSection>
      )}

      {languages.length > 0 && (
        <SheetSection label="Language">
          <ChipGroup label="Language">
            {languages.map((language) => (
              <FilterChip key={language.value} tone="accent" selected={draft.languages.includes(language.value)} onClick={() => setDraft((d) => ({ ...d, languages: toggle(d.languages, language.value) }))}>
                {language.value}
              </FilterChip>
            ))}
          </ChipGroup>
        </SheetSection>
      )}

      <SheetSection label="Sort by">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {SORT_OPTIONS.map((option) => (
            <RadioRow key={option.value} name="library-sort" label={option.label} checked={draft.sort === option.value} onChange={() => setDraft((d) => ({ ...d, sort: option.value }))} />
          ))}
        </div>
      </SheetSection>
    </Modal>
  )
}
