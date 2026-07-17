interface PresentableProfile {
  firstName?: string | null;
  lastName?: string | null;
  country?: string | null;
  timezone?: string | null;
  language?: string | null;
  bio?: string | null;
}

interface PresentableUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  emailVerified: boolean;
  status: string;
  role: string;
  profile?: PresentableProfile | null;
  createdAt: Date;
  updatedAt: Date;
}

export function presentUser(user: PresentableUser) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    status: user.status,
    role: user.role,
    profile: user.profile
      ? {
          firstName: user.profile.firstName,
          lastName: user.profile.lastName,
          country: user.profile.country,
          timezone: user.profile.timezone,
          language: user.profile.language,
          bio: user.profile.bio
        }
      : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}
