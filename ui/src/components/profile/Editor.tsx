import { useState } from "react";
import type { BasicProfile, UserProfile, UserType } from "@/types/nostrill";
import ModalCloseButton from "@/components/ui/ModalCloseButton";
import { getCustomProfileFields, getProfileBanner } from "@/logic/userDisplay";
import useLocalState from "@/state/state";
import toast from "react-hot-toast";
import Avatar from "../Avatar";
import { Camera, Info, Plus, X } from "lucide-react";

interface ProfileEditorProps {
  user: UserType;
  userString: string;
  profile: UserProfile | undefined;
  onSave?: () => void;
}

const ProfileEditor: React.FC<ProfileEditorProps> = ({
  user,
  profile,
  userString,
  onSave,
}) => {
  const { api, setModal } = useLocalState((s) => ({
    api: s.api,
    setModal: s.setModal,
  }));

  const initialBanner = getProfileBanner(profile);
  const initialFields = getCustomProfileFields(profile).map(([key, value]) => ({
    key,
    value,
  }));

  const [name, setName] = useState(profile?.name || userString);
  const [picture, setPicture] = useState(profile?.picture || "");
  const [banner, setBanner] = useState(initialBanner);
  const [about, setAbout] = useState(profile?.about || "");
  const [customFields, setCustomFields] = useState(initialFields);
  const [isSaving, setIsSaving] = useState(false);

  const handleFilePreview =
    (setter: (value: string) => void) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") setter(reader.result);
      };
      reader.readAsDataURL(file);
    };

  const updateCustomField = (
    index: number,
    field: "key" | "value",
    value: string,
  ) => {
    setCustomFields((fields) =>
      fields.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const handleSave = async () => {
    if (!api || typeof api.createProfile !== "function") {
      toast.error("Profile update API not available");
      return;
    }

    setIsSaving(true);
    try {
      const other: Record<string, string> = {};
      if (banner.trim()) other.banner = banner.trim();
      customFields.forEach(({ key, value }) => {
        if (key.trim()) other[key.trim()] = value;
      });

      const nextProfile: BasicProfile = {
        name: name.trim(),
        picture: picture.trim(),
        about,
        other,
      };

      await api.createProfile(nextProfile);
      toast.success("Profile updated successfully");
      onSave?.();
      setModal(null);
    } catch (error) {
      toast.error("Failed to update profile");
      console.error("Failed to save profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const close = () => setModal(null);
  const nameRemaining = Math.max(0, 32 - name.length);
  const bioRemaining = Math.max(0, 180 - about.length);
  const saveDisabled = isSaving || !name.trim();

  return (
    <div id="edit-profile-modal" className="edit-profile-modal">
      <header className="edit-profile-header">
        <ModalCloseButton onClick={close} />
        <h1>Edit profile</h1>
        <button
          className="modal-primary-button"
          onClick={handleSave}
          disabled={saveDisabled}
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </header>

      <div className="edit-profile-scroll">
        <div
          className={`edit-profile-banner${banner ? " image" : " generated"}`}
          style={banner ? { backgroundImage: `url(${banner})` } : undefined}
        >
          <label className="edit-profile-camera" title="Change cover">
            <input
              type="file"
              accept="image/*"
              onChange={handleFilePreview(setBanner)}
            />
            <Camera size={20} />
          </label>
        </div>

        <div className="edit-profile-preview">
          <div className="edit-profile-avatar-wrap">
            <div className="edit-profile-avatar">
              {picture ? (
                <img src={picture} alt="" />
              ) : (
                <Avatar user={user} profile={profile} size={84} picOnly />
              )}
            </div>
            <label className="edit-profile-avatar-camera" title="Change avatar">
              <input
                type="file"
                accept="image/*"
                onChange={handleFilePreview(setPicture)}
              />
              <Camera size={20} />
            </label>
          </div>

          <div className="edit-profile-url-fields">
            <label>
              <span>Avatar</span>
              <input
                className="mono"
                value={picture}
                onChange={(e) => setPicture(e.target.value)}
                placeholder="paste image URL, or use the camera"
              />
            </label>
            <label>
              <span>Cover</span>
              <input
                className="mono"
                value={banner}
                onChange={(e) => setBanner(e.target.value)}
                placeholder="paste image URL, or use the camera"
              />
            </label>
          </div>

          <div className="edit-profile-note">
            <Info size={14} />
            <span>
              Leave the avatar blank to fall back to your identity{" "}
              <span className="mono">sigil</span>. Your{" "}
              <span className="mono">~ship</span> can't be changed.
            </span>
          </div>
        </div>

        <div className="edit-profile-fields">
          <label className="edit-profile-field">
            <span>Display name</span>
            <div className="edit-profile-counted-input">
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 32))}
                placeholder="Your display name"
              />
              <span className="mono">{nameRemaining}</span>
            </div>
          </label>

          <label className="edit-profile-field">
            <span>Bio</span>
            <div className="edit-profile-counted-input textarea">
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value.slice(0, 180))}
                placeholder="Tell the fleet about yourself"
              />
              <span className="mono">{bioRemaining}</span>
            </div>
          </label>

          <div className="edit-profile-custom-head">
            <span>Custom fields</span>
            <button
              className="edit-profile-add-field"
              onClick={() =>
                setCustomFields((fields) => [...fields, { key: "", value: "" }])
              }
            >
              <Plus size={14} />
              Add field
            </button>
          </div>

          <div className="edit-profile-custom-fields">
            {customFields.map((field, index) => (
              <div className="edit-profile-custom-row" key={index}>
                <input
                  value={field.key}
                  onChange={(e) =>
                    updateCustomField(index, "key", e.target.value)
                  }
                  placeholder="label"
                />
                <input
                  value={field.value}
                  onChange={(e) =>
                    updateCustomField(index, "value", e.target.value)
                  }
                  placeholder="value or URL"
                />
                <button
                  onClick={() =>
                    setCustomFields((fields) =>
                      fields.filter((_, fieldIndex) => fieldIndex !== index),
                    )
                  }
                  title="Remove field"
                  aria-label="Remove field"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            {customFields.length === 0 && (
              <div className="edit-profile-empty-fields">
                No custom fields yet - add things like website, location, or
                lightning address.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditor;
