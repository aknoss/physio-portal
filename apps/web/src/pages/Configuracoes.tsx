import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UpdateProfileRequest } from '@physio-portal/contracts';
import { useAuth } from '../auth/AuthContext';
import { updateProfile, uploadSignature } from '../api/auth';

type ProfileForm = {
  fullName: string;
  cref: string;
};

export function Configuracoes() {
  const { user, refresh } = useAuth();
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [signatureMessage, setSignatureMessage] = useState<string | null>(null);
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(UpdateProfileRequest),
    defaultValues: { fullName: '', cref: '' },
  });

  useEffect(() => {
    if (user) reset({ fullName: user.fullName, cref: user.cref });
  }, [user, reset]);

  const onProfileSubmit = handleSubmit(async (values) => {
    setProfileMessage(null);
    await updateProfile(values);
    await refresh();
    setProfileMessage('Perfil atualizado com sucesso.');
  });

  const onUpload = async () => {
    if (!file) return;
    setSignatureMessage(null);
    setSignatureError(null);
    setUploading(true);
    try {
      await uploadSignature(file);
      await refresh();
      setSignatureMessage('Assinatura enviada com sucesso.');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      setSignatureError('Erro ao enviar assinatura.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Configurações</h1>

      <form
        onSubmit={onProfileSubmit}
        noValidate
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
      >
        <h2 className="text-lg font-semibold">Perfil</h2>
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium">
            Nome completo
          </label>
          <input
            id="fullName"
            type="text"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            {...register('fullName')}
          />
          {errors.fullName && (
            <p className="mt-1 text-sm text-red-600">{errors.fullName.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="cref" className="block text-sm font-medium">
            CREF
          </label>
          <input
            id="cref"
            type="text"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            {...register('cref')}
          />
          {errors.cref && (
            <p className="mt-1 text-sm text-red-600">{errors.cref.message}</p>
          )}
        </div>
        {profileMessage && (
          <p role="status" className="text-sm text-emerald-700">
            {profileMessage}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Salvar
        </button>
      </form>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Assinatura</h2>
        {user?.signatureUrl && (
          <img
            src={user.signatureUrl}
            alt="Assinatura atual"
            className="max-h-32 border border-slate-200"
          />
        )}
        <div>
          <label htmlFor="signature" className="block text-sm font-medium">
            Assinatura (PNG)
          </label>
          <input
            id="signature"
            ref={fileInputRef}
            type="file"
            accept="image/png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block text-sm"
          />
        </div>
        {signatureMessage && (
          <p role="status" className="text-sm text-emerald-700">
            {signatureMessage}
          </p>
        )}
        {signatureError && (
          <p role="alert" className="text-sm text-red-600">
            {signatureError}
          </p>
        )}
        <button
          type="button"
          onClick={onUpload}
          disabled={!file || uploading}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Enviar assinatura
        </button>
      </section>
    </section>
  );
}
