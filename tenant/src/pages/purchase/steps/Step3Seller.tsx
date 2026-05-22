import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Controller, type Control, type UseFormRegister, type UseFormSetValue, type FieldErrors,
} from 'react-hook-form';
import { Check, X, ChevronDown } from 'lucide-react';

import Input from '@/components/ui/labeled-input';
import DocumentUploader from '@/components/DocumentUploader';
import { requestPurchaseUploadUrl } from '@/api/purchases';
import { type CounterpartyOut } from '@/api/counterparties';

import { StepShell } from '../Wizard';
import { Field, SegmentedRow } from '../primitives';
import { SellerSearch } from '../SellerSearch';
import { DOC_TYPES, type FormValues } from '../types';

interface Props {
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  values: FormValues;
  errors: FieldErrors<FormValues>;
  sellerPhotos: string[];
  onSellerPhotosChange: (next: string[]) => void;
}

export default function Step3Seller({
  control, register, setValue, values, errors,
  sellerPhotos, onSellerPhotosChange,
}: Props) {
  const { t } = useTranslation();
  const [docsOpen, setDocsOpen] = useState(
    !!(values.seller_doc_number || values.seller_tg || sellerPhotos.length > 0),
  );

  const onPickCounterparty = (cp: CounterpartyOut) => {
    setValue('counterparty_id', cp.id, { shouldValidate: true });
    setValue('seller_full_name', cp.full_name, { shouldValidate: true });
    setValue('seller_phone', cp.phone ?? '', { shouldValidate: true });
    setValue('seller_doc_type', cp.doc_type ?? '');
    setValue('seller_doc_number', cp.doc_number ?? '');
    setValue('seller_tg', cp.tg_username ? `@${cp.tg_username.replace(/^@/, '')}` : '');
  };

  const onClearCounterparty = () => {
    setValue('counterparty_id', null);
    setValue('seller_full_name', '');
    setValue('seller_phone', '');
    setValue('seller_doc_type', '');
    setValue('seller_doc_number', '');
    setValue('seller_tg', '');
  };

  const isLinked = values.counterparty_id !== null;

  return (
    <StepShell
      step={2}
      title={t('purchase.step3_title')}
      subtitle={t('purchase.step3_subtitle')}
    >
      <div className="card p-5 md:p-6 flex flex-col gap-4">
        <SellerSearch disabled={isLinked} onPick={onPickCounterparty} />

        {isLinked && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-success-faded border border-success/30 animate-fade-in">
            <div className="flex items-center gap-2 text-success font-semibold text-label min-w-0">
              <Check size={16} className="shrink-0" />
              <span className="truncate">{values.seller_full_name}</span>
            </div>
            <button
              type="button"
              onClick={onClearCounterparty}
              className="text-text-dim hover:text-text text-xs flex items-center gap-1 cursor-pointer shrink-0"
            >
              <X size={12} /> {t('common.cancel')}
            </button>
          </div>
        )}

        {!isLinked && (
          <>
            <Input
              label={t('purchase.seller_full_name_label')}
              placeholder={t('purchase.seller_full_name_placeholder')}
              required
              error={errors.seller_full_name?.message}
              {...register('seller_full_name')}
            />
            <Input
              label={t('purchase.seller_phone_label')}
              placeholder={t('purchase.seller_phone_placeholder')}
              error={errors.seller_phone?.message}
              inputMode="tel"
              autoComplete="off"
              {...register('seller_phone')}
            />

            <div className="border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setDocsOpen((o) => !o)}
                className="flex items-center justify-between w-full text-label font-semibold text-text-dim hover:text-text transition-colors cursor-pointer"
              >
                <span>{t('purchase.seller_details_optional')}</span>
                <ChevronDown
                  size={16}
                  className={`transition-transform ${docsOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {docsOpen && (
                <div className="mt-4 flex flex-col gap-4 animate-fade-in">
                  <Input
                    label={t('purchase.seller_tg_label')}
                    placeholder={t('purchase.seller_tg_placeholder')}
                    autoComplete="off"
                    {...register('seller_tg')}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label={t('purchase.seller_doc_type_label')}>
                      <Controller
                        control={control}
                        name="seller_doc_type"
                        render={({ field }) => (
                          <SegmentedRow
                            value={field.value || ''}
                            onChange={field.onChange}
                            allowEmpty
                            options={DOC_TYPES.map((d) => ({
                              value: d, label: t(`purchase.doc_type.${d}`),
                            }))}
                          />
                        )}
                      />
                    </Field>
                    <Input
                      label={t('purchase.seller_doc_number_label')}
                      placeholder={t('purchase.seller_doc_number_placeholder')}
                      error={errors.seller_doc_number?.message}
                      autoComplete="off"
                      {...register('seller_doc_number')}
                    />
                  </div>
                  <DocumentUploader
                    label={t('purchase.seller_photos_label')}
                    value={sellerPhotos}
                    onChange={onSellerPhotosChange}
                    requestUploadUrl={requestPurchaseUploadUrl}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </StepShell>
  );
}
