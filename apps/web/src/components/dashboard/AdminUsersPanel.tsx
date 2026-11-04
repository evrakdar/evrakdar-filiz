"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { generatePassword, isStrongPassword, PASSWORD_RULE_TEXT } from "@/lib/password";
import { PasswordField } from "./PasswordField";
import {
  createAdminUser,
  activateAdminUser,
  deactivateAdminUser,
  removeAdminUser,
  getAdminUserErrorMessage,
  getAdminUsers,
  getDepartments,
  updateAdminUser,
  suggestAdminUserAccount,
  updateAdminUserRoles,
  type AdminUserDto,
  type AdminUserRole,
  type DepartmentDto,
  type UpdateAdminUserInput
} from "@/lib/api";

type AdminUsersPanelProps = {
  token: string | null;
  currentUserId?: string;
  /** Opens the page that explains the roles, for whoever may see it. */
  onOpenRoles?: () => void;
};

type EditFormState = {
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  username: string;
  password: string;
  departmentId: string;
  role: AdminUserRole;
};

type CreateFormState = EditFormState;

type IssuedPassword = {
  personName: string;
  password: string;
};

const emptyCreateForm: CreateFormState = {
  firstName: "",
  lastName: "",
  title: "",
  email: "",
  username: "",
  password: "",
  departmentId: "",
  role: "VIEWER"
};

const roleOptions: Array<{ value: AdminUserRole; label: string }> = [
  { value: "ADMIN", label: "Yönetici" },
  { value: "EDITOR", label: "Düzenleyici" },
  { value: "VIEWER", label: "Kullanıcı" }
];

const pageSize = 10;

export function AdminUsersPanel({ token, currentUserId, onOpenRoles }: AdminUsersPanelProps) {
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [suggestionLock, setSuggestionLock] = useState({ username: false, email: false });
  const [roleFilter, setRoleFilter] = useState<AdminUserRole | "">("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [editingUser, setEditingUser] = useState<AdminUserDto | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [createForm, setCreateForm] = useState<CreateFormState | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [issuedPassword, setIssuedPassword] = useState<IssuedPassword | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!token) {
      setStatus("error");
      setError("Kullanıcı yönetimi için oturum doğrulaması gerekir.");
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      const response = await getAdminUsers(
        {
          q: query,
          role: roleFilter,
          page,
          limit: pageSize
        },
        token
      );

      setUsers(response.data);
      setTotal(response.meta.total);
      setTotalPages(Math.max(response.meta.totalPages, 1));
      setStatus("ready");
    } catch (loadError) {
      setUsers([]);
      setStatus("error");
      setError(getAdminUserErrorMessage(loadError));
    }
  }, [page, query, roleFilter, token]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    let isActive = true;

    getDepartments()
      .then((response) => {
        if (isActive) {
          setDepartments(response.data);
        }
      })
      .catch(() => {
        if (isActive) {
          setDepartments([]);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const activeUserCount = useMemo(
    () => users.filter((user) => user.isActive !== false).length,
    [users]
  );

  function handleSearch(value: string) {
    setQuery(value);
    setPage(1);
  }

  function handleRoleFilter(value: string) {
    setRoleFilter(value as AdminUserRole | "");
    setPage(1);
  }

  function openEditPanel(user: AdminUserDto) {
    setMessage(null);
    setError(null);
    setCreateForm(null);
    setEditingUser(user);
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      title: user.title ?? "",
      email: user.email,
      username: user.username,
      password: "",
      departmentId: user.department?.id ?? "",
      role: getCurrentRole(user.roles)
    });
  }

  async function submitCreateForm() {
    if (!token || !createForm) {
      return;
    }

    setMessage(null);
    setError(null);

    if (!isStrongPassword(createForm.password.trim())) {
      setError(`Şifre kurala uymuyor. ${PASSWORD_RULE_TEXT}`);
      return;
    }

    setIsCreating(true);

    try {
      await createAdminUser(
        {
          firstName: createForm.firstName,
          lastName: createForm.lastName,
          title: createForm.title || null,
          email: createForm.email,
          username: createForm.username,
          password: createForm.password,
          role: createForm.role,
          departmentId: createForm.departmentId || null
        },
        token
      );
      showIssuedPassword(`${createForm.firstName} ${createForm.lastName}`, createForm.password.trim());
      setCreateForm(null);
      setSuggestionLock({ username: false, email: false });
      setMessage("Yeni kullanıcı eklendi.");
      await loadUsers();
    } catch (createError) {
      setError(getAdminUserErrorMessage(createError));
    } finally {
      setIsCreating(false);
    }
  }

  // Fill in a free username (and address, where the institution has set one up) until it is changed by hand.
  const suggestionFirstName = createForm?.firstName ?? "";
  const suggestionLastName = createForm?.lastName ?? "";
  const suggestionDepartmentId = createForm?.departmentId ?? "";
  const isCreateFormOpen = Boolean(createForm);

  useEffect(() => {
    if (!token || !isCreateFormOpen || !suggestionFirstName.trim() || !suggestionLastName.trim()) {
      return;
    }

    let isActive = true;
    const timer = window.setTimeout(() => {
      suggestAdminUserAccount(
        { firstName: suggestionFirstName, lastName: suggestionLastName, departmentId: suggestionDepartmentId || null },
        token
      )
        .then((response) => {
          if (!isActive) {
            return;
          }

          setCreateForm((form) =>
            form
              ? {
                  ...form,
                  username: suggestionLock.username ? form.username : response.data.username,
                  email: suggestionLock.email || !response.data.email ? form.email : response.data.email
                }
              : form
          );
        })
        .catch(() => undefined);
    }, 300);

    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [isCreateFormOpen, suggestionDepartmentId, suggestionFirstName, suggestionLastName, suggestionLock, token]);

  async function submitEditForm() {
    if (!token || !editingUser || !editForm) {
      return;
    }

    setMessage(null);
    setError(null);

    if (editForm.password.trim() && !isStrongPassword(editForm.password.trim())) {
      setError(`Şifre kurala uymuyor. ${PASSWORD_RULE_TEXT}`);
      return;
    }

    setPendingUserId(editingUser.id);

    const input: UpdateAdminUserInput = {
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      title: editForm.title || null,
      email: editForm.email,
      username: editForm.username,
      departmentId: editForm.departmentId || null
    };

    if (editForm.password.trim()) {
      input.password = editForm.password.trim();
    }

    try {
      await updateAdminUser(editingUser.id, input, token);

      if (input.password && editingUser.id !== currentUserId) {
        showIssuedPassword(`${editForm.firstName} ${editForm.lastName}`, input.password);
      }

      if (editForm.role !== getCurrentRole(editingUser.roles)) {
        try {
          await updateAdminUserRoles(editingUser.id, [editForm.role], token);
        } catch (roleError) {
          // The details are saved by now; say plainly that only the role did not change.
          setError(`Bilgiler kaydedildi ama rol değişmedi: ${getAdminUserErrorMessage(roleError)}`);
          await loadUsers();
          return;
        }
      }

      setMessage("Kullanıcı bilgileri güncellendi.");
      setEditingUser(null);
      setEditForm(null);
      await loadUsers();
    } catch (updateError) {
      setError(getAdminUserErrorMessage(updateError));
    } finally {
      setPendingUserId(null);
    }
  }

  async function handleRoleChange(user: AdminUserDto, nextRole: AdminUserRole) {
    if (!token || user.roles.includes(nextRole)) {
      return;
    }

    const confirmed = window.confirm(`${user.firstName} ${user.lastName} için rol ${getRoleLabel(nextRole)} olarak güncellensin mi?`);

    if (!confirmed) {
      return;
    }

    setPendingUserId(user.id);
    setMessage(null);
    setError(null);

    try {
      await updateAdminUserRoles(user.id, [nextRole], token);
      setMessage("Kullanıcı yetkisi güncellendi.");
      await loadUsers();
    } catch (roleError) {
      setError(getAdminUserErrorMessage(roleError));
    } finally {
      setPendingUserId(null);
    }
  }

  function showIssuedPassword(personName: string, password: string) {
    setCopyFailed(false);
    setIssuedPassword({ personName, password });
  }

  async function copyIssuedPassword() {
    if (!issuedPassword) {
      return;
    }

    try {
      await navigator.clipboard.writeText(issuedPassword.password);
      setMessage("Şifre kopyalandı.");
    } catch {
      // Browsers allow this only on secure addresses, so a system on a plain address lands here.
      setCopyFailed(true);
    }
  }

  async function handleActivate(user: AdminUserDto) {
    if (!token) {
      return;
    }

    setPendingUserId(user.id);
    setMessage(null);
    setError(null);

    try {
      await activateAdminUser(user.id, token);
      setMessage("Kullanıcı aktifleştirildi.");
      await loadUsers();
    } catch (activateError) {
      setError(getAdminUserErrorMessage(activateError));
    } finally {
      setPendingUserId(null);
    }
  }

  async function handleRemove(user: AdminUserDto) {
    if (!token) {
      return;
    }

    const confirmed = window.confirm(
      `${user.firstName} ${user.lastName} listeden kalıcı olarak silinsin mi? Bu geri alınamaz. Eski kayıtlarda adı görünmeye devam eder.`
    );

    if (!confirmed) {
      return;
    }

    setPendingUserId(user.id);
    setMessage(null);
    setError(null);

    try {
      await removeAdminUser(user.id, token);
      setMessage("Kullanıcı silindi.");
      await loadUsers();
    } catch (removeError) {
      setError(getAdminUserErrorMessage(removeError));
    } finally {
      setPendingUserId(null);
    }
  }

  async function handleDeactivate(user: AdminUserDto) {
    if (!token) {
      return;
    }

    if (user.id === currentUserId) {
      setError("Kendi hesabınızı pasifleştiremezsiniz.");
      return;
    }

    const confirmed = window.confirm(`${user.firstName} ${user.lastName} kullanıcısı pasifleştirilsin mi?`);

    if (!confirmed) {
      return;
    }

    setPendingUserId(user.id);
    setMessage(null);
    setError(null);

    try {
      await deactivateAdminUser(user.id, token);
      setMessage("Kullanıcı pasifleştirildi.");
      await loadUsers();
    } catch (deactivateError) {
      setError(getAdminUserErrorMessage(deactivateError));
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <section className="space-y-5" aria-label="Tüm Kullanıcılar ve Yetkilendirme">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-800 dark:text-brand-300">Yönetim</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Tüm Kullanıcılar ve Yetkilendirme
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Kullanıcı bilgilerini görüntüleyin, rol atayın ve gerektiğinde hesapları pasifleştirin.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingUser(null);
              setEditForm(null);
              setMessage(null);
              setError(null);
              setIssuedPassword(null);
              setCreateForm({ ...emptyCreateForm, password: generatePassword(), role: getDefaultRole(roleOptions) });
            }}
            className="w-fit rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-900"
          >
            Yeni kullanıcı
          </button>
          <button
            onClick={loadUsers}
            className="w-fit rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Yenile
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:grid-cols-[1fr_220px]">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Arama
          <input
            value={query}
            onChange={(event) => handleSearch(event.target.value)}
            className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-brand-700 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-brand-950"
            placeholder="Ad, soyad, kullanıcı adı veya e-posta"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Rol filtresi
          <select
            value={roleFilter}
            onChange={(event) => handleRoleFilter(event.target.value)}
            className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-brand-700 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-brand-950"
          >
            <option value="">Tümü</option>
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {message ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {issuedPassword ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100">
          <p>
            {issuedPassword.personName} için geçici şifre. Kişiye iletin, ilk girişinde değiştirmesi istenir. Bu kutu kapanınca şifre bir daha görünmez.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="select-all rounded border border-green-200 bg-white px-2 py-1 font-mono text-base text-zinc-950 dark:border-green-900 dark:bg-zinc-950 dark:text-zinc-50">
              {issuedPassword.password}
            </code>
            <button
              type="button"
              onClick={copyIssuedPassword}
              className="rounded-md border border-green-300 px-3 py-1.5 text-xs font-medium transition hover:bg-green-100 dark:border-green-800 dark:hover:bg-green-900"
            >
              Kopyala
            </button>
            <button
              type="button"
              onClick={() => setIssuedPassword(null)}
              className="rounded-md border border-green-300 px-3 py-1.5 text-xs font-medium transition hover:bg-green-100 dark:border-green-800 dark:hover:bg-green-900"
            >
              Kapat
            </button>
          </div>
          {copyFailed ? <p className="mt-2 text-xs">Kopyalanamadı. Şifreye tıklayıp elle kopyalayın.</p> : null}
        </div>
      ) : null}

      {createForm ? (
        <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Yeni kullanıcı ekle</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Şifre kendiliğinden üretildi, isterseniz değiştirin. Kişiden ilk girişinde kendi şifresini belirlemesi istenir.
              </p>
            </div>
            <button
              onClick={() => setCreateForm(null)}
              className="rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Kapat
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <TextField label="Ad" value={createForm.firstName} onChange={(value) => setCreateForm({ ...createForm, firstName: value })} />
            <TextField label="Soyad" value={createForm.lastName} onChange={(value) => setCreateForm({ ...createForm, lastName: value })} />
            <TextField label="Ünvan" value={createForm.title} onChange={(value) => setCreateForm({ ...createForm, title: value })} />
            <TextField label="E-posta" value={createForm.email} onChange={(value) => {
              setSuggestionLock((lock) => ({ ...lock, email: true }));
              setCreateForm({ ...createForm, email: value });
            }} />
            <RoleField options={roleOptions} value={createForm.role} onChange={(value) => setCreateForm({ ...createForm, role: value })} onExplain={onOpenRoles} />
            <DepartmentField
              departments={departments}
              value={createForm.departmentId}
              onChange={(value) => setCreateForm({ ...createForm, departmentId: value })}
            />
            <TextField label="Kullanıcı adı" value={createForm.username} onChange={(value) => {
              setSuggestionLock((lock) => ({ ...lock, username: true }));
              setCreateForm({ ...createForm, username: value });
            }} />
            <PasswordField
              label="Şifre"
              startVisible
              showRule
              value={createForm.password}
              onChange={(value) => setCreateForm({ ...createForm, password: value })}
              action={{ label: "Yeniden üret", onClick: () => setCreateForm({ ...createForm, password: generatePassword() }) }}
            />
          </div>
          <button
            onClick={submitCreateForm}
            disabled={isCreating}
            className="mt-4 rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreating ? "Ekleniyor..." : "Kullanıcıyı ekle"}
          </button>
        </div>
      ) : null}

      {editingUser && editForm ? (
        <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Kullanıcı bilgilerini güncelle</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Mevcut şifre güvenlik nedeniyle görüntülenemez. Yeni şifre girilmezse mevcut şifre korunur.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingUser(null);
                setEditForm(null);
              }}
              className="rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Kapat
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <TextField label="Ad" value={editForm.firstName} onChange={(value) => setEditForm({ ...editForm, firstName: value })} />
            <TextField label="Soyad" value={editForm.lastName} onChange={(value) => setEditForm({ ...editForm, lastName: value })} />
            <TextField label="Ünvan" value={editForm.title} onChange={(value) => setEditForm({ ...editForm, title: value })} />
            <TextField label="E-posta" value={editForm.email} onChange={(value) => setEditForm({ ...editForm, email: value })} />
            <TextField label="Kullanıcı adı" value={editForm.username} onChange={(value) => setEditForm({ ...editForm, username: value })} />
            <TextField label="Mevcut şifre" value="••••••••" onChange={() => undefined} readOnly />
            <RoleField options={roleOptions} value={editForm.role} onChange={(value) => setEditForm({ ...editForm, role: value })} onExplain={onOpenRoles} />
            <DepartmentField
              departments={departments}
              value={editForm.departmentId}
              onChange={(value) => setEditForm({ ...editForm, departmentId: value })}
            />
            <PasswordField
              label="Yeni şifre"
              showRule
              value={editForm.password}
              onChange={(value) => setEditForm({ ...editForm, password: value })}
              placeholder="Değiştirmek istemiyorsanız boş bırakın"
              action={{ label: "Şifre üret", onClick: () => setEditForm({ ...editForm, password: generatePassword() }) }}
            />
          </div>
          <button
            onClick={submitEditForm}
            disabled={pendingUserId === editingUser.id}
            className="mt-4 rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingUserId === editingUser.id ? "Güncelleniyor..." : "Değişiklikleri kaydet"}
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {status === "loading" ? (
          <PanelMessage title="Kullanıcılar yükleniyor" description="Kullanıcı yönetimi listesi hazırlanıyor." />
        ) : null}

        {status === "error" ? (
          <PanelMessage
            title="Kullanıcılar yüklenemedi"
            description={error ?? "Sunucudan yanıt alınamadı."}
            actionLabel="Tekrar dene"
            onAction={loadUsers}
          />
        ) : null}

        {status === "ready" && users.length === 0 ? (
          <PanelMessage title="Kullanıcı bulunamadı" description="Filtrelere uygun kullanıcı kaydı yok." />
        ) : null}

        {status === "ready" && users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Ad soyad</th>
                  <th className="px-4 py-3 font-semibold">Ünvan</th>
                  <th className="px-4 py-3 font-semibold">E-posta</th>
                  <th className="px-4 py-3 font-semibold">Kullanıcı adı</th>
                  <th className="px-4 py-3 font-semibold">Yetki</th>
                  <th className="px-4 py-3 font-semibold">Durum</th>
                  <th className="px-4 py-3 font-semibold">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {users.map((user) => {
                  const role = getCurrentRole(user.roles);
                  const isCurrentUser = user.id === currentUserId;
                  const isPending = pendingUserId === user.id;

                  return (
                    <tr key={user.id} className={user.isActive === false ? "bg-zinc-50 text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500" : ""}>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                        {user.firstName} {user.lastName}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{user.title ?? "-"}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{user.email}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{user.username}</td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={`${user.username} yetki`}
                          value={role}
                          disabled={isPending || user.isActive === false}
                          onChange={(event) => handleRoleChange(user, event.target.value as AdminUserRole)}
                          className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900 outline-none transition focus:border-brand-700 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        >
                          {roleOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${user.isActive === false ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"}`}>
                          {user.isActive === false ? "Pasif" : "Aktif"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            hidden={user.isActive === false}
                            onClick={() => openEditPanel(user)}
                            disabled={isPending}
                            className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            Güncelle
                          </button>
                          <button
                            hidden={user.isActive === false}
                            onClick={() => handleDeactivate(user)}
                            disabled={isPending || isCurrentUser}
                            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                          >
                            Pasifleştir
                          </button>
                          <button
                            hidden={user.isActive !== false}
                            onClick={() => handleActivate(user)}
                            disabled={isPending}
                            className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            Aktifleştir
                          </button>
                          <button
                            hidden={user.isActive !== false}
                            onClick={() => handleRemove(user)}
                            disabled={isPending}
                            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                          >
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 text-sm text-zinc-500 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Toplam {total.toLocaleString("tr-TR")} kullanıcı, bu sayfada {activeUserCount.toLocaleString("tr-TR")} aktif kayıt.
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((value) => Math.max(value - 1, 1))}
            disabled={page <= 1}
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Önceki
          </button>
          <span>
            Sayfa {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((value) => Math.min(value + 1, totalPages))}
            disabled={page >= totalPages}
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Sonraki
          </button>
        </div>
      </div>
    </section>
  );
}

function TextField({
  label,
  placeholder,
  readOnly = false,
  type = "text",
  value,
  onChange
}: {
  label: string;
  placeholder?: string;
  readOnly?: boolean;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
      {label}
      <input
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-brand-700 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-brand-950"
      />
    </label>
  );
}

function RoleField({
  options,
  value,
  onChange,
  onExplain
}: {
  options: Array<{ value: AdminUserRole; label: string }>;
  value: AdminUserRole;
  onChange: (value: AdminUserRole) => void;
  onExplain?: () => void;
}) {
  return (
    <div>
    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
      Rol
      <select
        aria-label="Rol"
        value={value}
        onChange={(event) => onChange(event.target.value as AdminUserRole)}
        className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-brand-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      >
        {options.map((role) => (
          <option key={role.value} value={role.value}>
            {role.label}
          </option>
        ))}
      </select>
    </label>
    {onExplain ? (
      <button
        type="button"
        onClick={onExplain}
        className="mt-1 text-xs font-medium text-brand-800 underline underline-offset-2 dark:text-brand-300"
      >
        Hangi rol ne yapabilir?
      </button>
    ) : null}
    </div>
  );
}

function DepartmentField({
  departments,
  value,
  onChange
}: {
  departments: DepartmentDto[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
      Birim
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-brand-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      >
        <option value="">Birim seçilmedi</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function PanelMessage({
  title,
  description,
  actionLabel,
  onAction
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="p-5">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
      {actionLabel && onAction ? (
        <button
          onClick={onAction}
          className="mt-4 rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-900"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function getCurrentRole(roles: AdminUserRole[]) {
  if (roles.includes("ADMIN")) {
    return "ADMIN";
  }

  if (roles.includes("EDITOR")) {
    return "EDITOR";
  }

  return roles[0] ?? "";
}

function getDefaultRole(options: Array<{ value: AdminUserRole }>) {
  return (
    options.find((option) => option.value === "VIEWER")?.value ??
    options.find((option) => option.value !== "ADMIN")?.value ??
    options[0]?.value ??
    ""
  );
}

function getRoleLabel(role: AdminUserRole) {
  return roleOptions.find((option) => option.value === role)?.label ?? role;
}
