import {
  acceptInvitationSchema,
  createTeamSchema,
  inviteMemberSchema,
  updateDepartmentSchema,
  updateMemberRolesSchema,
} from './organization';

describe('organization schemas', () => {
  it('normalises the invitee email and rejects mass-assignment fields', () => {
    const valid = { name: 'Grace', email: 'Grace@Example.com', roleKey: 'EMPLOYEE' };
    expect(inviteMemberSchema.parse(valid).email).toBe('grace@example.com');
    for (const key of ['organizationId', 'status', 'permissions']) {
      expect(inviteMemberSchema.safeParse({ ...valid, [key]: 'x' }).success).toBe(false);
    }
  });

  it('requires at least one distinct role', () => {
    expect(updateMemberRolesSchema.safeParse({ roleKeys: [] }).success).toBe(false);
    expect(updateMemberRolesSchema.safeParse({ roleKeys: ['ADMIN', 'ADMIN'] }).success).toBe(false);
    expect(updateMemberRolesSchema.safeParse({ roleKeys: ['ADMIN'] }).success).toBe(true);
  });

  it('applies the password policy when accepting an invitation', () => {
    expect(acceptInvitationSchema.safeParse({ password: 'short' }).success).toBe(false);
    expect(acceptInvitationSchema.safeParse({ password: 'a long enough passphrase' }).success).toBe(true);
  });

  it('requires a UUID department for teams', () => {
    expect(createTeamSchema.safeParse({ name: 'Platform', departmentId: 'eng' }).success).toBe(false);
  });

  it('rejects empty updates', () => {
    expect(updateDepartmentSchema.safeParse({}).success).toBe(false);
    expect(updateDepartmentSchema.safeParse({ name: 'Research' }).success).toBe(true);
  });
});
