import type { PermissionInfo } from '@knowguard/types';

/**
 * Permission checkboxes grouped by resource. Permissions the caller doesn't hold are shown
 * disabled: they can't be granted (the API would refuse with ROLE_EXCEEDS_YOUR_ACCESS anyway).
 */
export function PermissionPicker({
  catalog,
  grantable,
  selected = [],
  idPrefix,
}: {
  catalog: PermissionInfo[];
  grantable: readonly string[];
  selected?: readonly string[];
  idPrefix: string;
}) {
  const groups = new Map<string, PermissionInfo[]>();
  for (const permission of catalog) {
    groups.set(permission.group, [...(groups.get(permission.group) ?? []), permission]);
  }

  return (
    <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <legend className="mb-2 text-sm font-medium">Permissions</legend>
      {[...groups].map(([group, permissions]) => (
        <div key={group} className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group}</p>
          {permissions.map((permission) => {
            const id = `${idPrefix}-${permission.key}`;
            const disabled = !grantable.includes(permission.key);
            return (
              <label
                key={permission.key}
                htmlFor={id}
                className={
                  disabled ? 'flex items-start gap-2 text-sm opacity-50' : 'flex items-start gap-2 text-sm'
                }
                title={disabled ? 'You cannot grant a permission you do not hold.' : permission.description}
              >
                <input
                  id={id}
                  type="checkbox"
                  name="permissions"
                  value={permission.key}
                  defaultChecked={selected.includes(permission.key)}
                  disabled={disabled}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-mono text-xs">{permission.key}</span>
                  <span className="block text-xs text-muted-foreground">{permission.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      ))}
    </fieldset>
  );
}
