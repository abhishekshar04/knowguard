import type { DocumentVisibilityValue, SubjectRef } from '@knowguard/types';

import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { SubjectOptions } from '@/lib/subjects';

import { VISIBILITY_OPTIONS } from './document-labels';

/**
 * Visibility + audience inputs. The audience list is grouped by kind; only the group matching the
 * chosen visibility is used — the API rejects mismatched or missing audiences with a clear error.
 */
export function VisibilityFields({
  idPrefix,
  options,
  visibility = 'PRIVATE',
  audience = [],
}: {
  idPrefix: string;
  options: SubjectOptions;
  visibility?: DocumentVisibilityValue;
  audience?: SubjectRef[];
}) {
  const selected = audience.map((a) => a.id);
  const groups: Array<[string, SubjectRef[]]> = [
    ['Teams (for "Teams")', options.teams],
    ['Departments (for "Departments")', options.departments],
    ['Roles (for "Roles")', options.roles],
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-visibility`}>Who can read it</Label>
        <Select id={`${idPrefix}-visibility`} name="visibility" defaultValue={visibility}>
          {VISIBILITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} — {option.hint}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-audience`}>Audience (for Teams / Departments / Roles)</Label>
        <Select
          id={`${idPrefix}-audience`}
          name="audienceIds"
          multiple
          defaultValue={selected}
          className="kg-select-multi h-28 bg-none py-1.5"
        >
          {groups.map(([label, refs]) =>
            refs.length > 0 ? (
              <optgroup key={label} label={label}>
                {refs.map((ref) => (
                  <option key={ref.id} value={ref.id}>
                    {ref.name}
                  </option>
                ))}
              </optgroup>
            ) : null,
          )}
        </Select>
      </div>
    </div>
  );
}
