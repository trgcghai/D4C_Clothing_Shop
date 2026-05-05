import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { extractErrorMessage } from "../lib/auth-contract";
import {
  useAuthBootstrapQuery,
  useChangePasswordMutation,
  useUpdateProfileMutation,
} from "../hooks/useAuth";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Label from "../components/ui/Label";
import Alert from "../components/ui/Alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";

export default function Profile() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const meQuery = useAuthBootstrapQuery(accessToken);
  const user = meQuery.data;
  const isLoadingUser = meQuery.isPending;
  const meError = meQuery.error;
  const updateProfileMutation = useUpdateProfileMutation();
  const changePasswordMutation = useChangePasswordMutation();

  const [profileForm, setProfileForm] = useState({
    fullName: "",
    phoneNumber: "",
    avatar: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
  });
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (user) {
      setProfileForm({
        fullName: user?.fullName || "",
        phoneNumber: user?.phoneNumber || "",
        avatar: user?.avatar || "",
      });
    }
  }, [user]);

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileError("");
    setProfileMessage("");
    try {
      await updateProfileMutation.mutateAsync({
        fullName: profileForm.fullName.trim(),
        phoneNumber: profileForm.phoneNumber.trim(),
        avatar: profileForm.avatar.trim(),
      });
      setProfileMessage("Profile updated successfully");
    } catch (error) {
      setProfileError(extractErrorMessage(error, "Failed to update profile"));
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    try {
      const response = await changePasswordMutation.mutateAsync(passwordForm);
      setPasswordMessage(response?.message || "Password changed successfully");
      setPasswordForm({ oldPassword: "", newPassword: "" });
    } catch (error) {
      setPasswordError(extractErrorMessage(error, "Failed to change password"));
    }
  };

  if (isLoadingUser) {
    return <div className="py-10 text-center">Loading profile...</div>;
  }

  return (
    <section className="container mx-auto grid gap-6 px-4 py-8 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>View and update account information.</CardDescription>
        </CardHeader>
        <CardContent>
          {profileError ? (
            <Alert variant="error" className="mb-4" role="alert" aria-live="polite">
              {profileError}
            </Alert>
          ) : null}
          {!profileError && meError ? (
            <Alert variant="error" className="mb-4" role="alert" aria-live="polite">
              {extractErrorMessage(meError, "Failed to load profile")}
            </Alert>
          ) : null}
          {profileMessage ? (
            <Alert variant="success" className="mb-4" role="status" aria-live="polite">
              {profileMessage}
            </Alert>
          ) : null}

          <div className="mb-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700">
            <p>
              <strong>Username:</strong> {user?.username}
            </p>
            <p>
              <strong>Email:</strong> {user?.email}
            </p>
            <p>
              <strong>Role:</strong> {user?.role}
            </p>
          </div>

          <form className="space-y-3" onSubmit={handleProfileSubmit}>
            <div>
              <Label htmlFor="profile-fullName">Full name</Label>
              <Input
                id="profile-fullName"
                value={profileForm.fullName}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, fullName: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="profile-phone">Phone number</Label>
              <Input
                id="profile-phone"
                value={profileForm.phoneNumber}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="profile-avatar">Avatar URL</Label>
              <Input
                id="profile-avatar"
                type="url"
                value={profileForm.avatar}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, avatar: event.target.value }))}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? "Saving..." : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Use current password to set a new one.</CardDescription>
        </CardHeader>
        <CardContent>
          {passwordError ? (
            <Alert variant="error" className="mb-4" role="alert" aria-live="polite">
              {passwordError}
            </Alert>
          ) : null}
          {passwordMessage ? (
            <Alert variant="success" className="mb-4" role="status" aria-live="polite">
              {passwordMessage}
            </Alert>
          ) : null}

          <form className="space-y-3" onSubmit={handlePasswordSubmit}>
            <div>
              <Label htmlFor="password-old">Current password</Label>
              <Input
                id="password-old"
                type="password"
                required
                minLength={6}
                value={passwordForm.oldPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, oldPassword: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="password-new">New password</Label>
              <Input
                id="password-new"
                type="password"
                required
                minLength={6}
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? "Updating..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}

