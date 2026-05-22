import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, type Control, type UseFormRegister, type FieldErrors } from 'react-hook-form';
import { ChevronDown } from 'lucide-react';

import Input from '@/components/ui/labeled-input';
import DocumentUploader from '@/components/DocumentUploader';
import { requestDeviceUploadUrl } from '@/api/devices';

import { StepShell } from '../Wizard';
import { TextArea } from '../primitives';
import { ImeiDupWarning } from '../ImeiDupWarning';
import DefectChecklist from '../DefectChecklist';
import SpecsForm from '../SpecsForm';
import { conditionFromDefects, type FormValues } from '../types';

interface Props {
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  values: FormValues;
  setValue: (name: 'condition', v: FormValues['condition']) => void;
  errors: FieldErrors<FormValues>;
  devicePhotos: string[];
  onDevicePhotosChange: (next: string[]) => void;
}

export default function Step2Device({
  control, register, values, setValue, errors,
  devicePhotos, onDevicePhotosChange,
}: Props) {
  const { t } = useTranslation();
  // Specs — collapse by default (опциональны). Раскрыт только если уже есть данные
  // (например пришло из «Повторить последнюю»).
  const hasSpecs = Object.keys(values.specs ?? {}).length > 0;
  const [specsOpen, setSpecsOpen] = useState(hasSpecs);
  const [notesOpen, setNotesOpen] = useState(!!values.device_notes);

  return (
    <StepShell
      step={1}
      title={t('purchase.step2_title')}
      subtitle={t('purchase.step2_subtitle')}
    >
      <div className="card p-5 md:p-6 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Input
              label={t('purchase.imei_label')}
              placeholder={t('purchase.imei_placeholder')}
              hint={t('purchase.imei_hint')}
              error={errors.imei?.message}
              inputMode="numeric"
              autoComplete="off"
              {...register('imei')}
            />
            <ImeiDupWarning imei={values.imei} />
          </div>
          <Input
            label={t('purchase.serial_label')}
            placeholder={t('purchase.serial_placeholder')}
            error={errors.serial?.message}
            autoComplete="off"
            {...register('serial')}
          />
        </div>

        <Controller
          control={control}
          name="defects"
          render={({ field }) => (
            <DefectChecklist
              value={field.value}
              onChange={(next) => {
                field.onChange(next);
                // Keep ``condition`` in lock-step so the submitted payload reflects the checklist.
                setValue('condition', conditionFromDefects(next));
              }}
            />
          )}
        />

        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setSpecsOpen((o) => !o)}
            className="flex items-center justify-between w-full text-label font-semibold text-text-dim hover:text-text transition-colors cursor-pointer"
          >
            <span>{t('purchase.specs_section')}</span>
            <ChevronDown
              size={16}
              className={`transition-transform ${specsOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {specsOpen && (
            <div className="mt-4 animate-fade-in">
              <Controller
                control={control}
                name="specs"
                render={({ field }) => (
                  <SpecsForm
                    category={values.category}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          )}
        </div>

        <DocumentUploader
          label={t('purchase.device_photos_label')}
          value={devicePhotos}
          onChange={onDevicePhotosChange}
          requestUploadUrl={requestDeviceUploadUrl}
          max={4}
          accept="image/*"
        />

        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setNotesOpen((o) => !o)}
            className="flex items-center justify-between w-full text-label font-semibold text-text-dim hover:text-text transition-colors cursor-pointer"
          >
            <span>{t('purchase.device_notes_label')}</span>
            <ChevronDown
              size={16}
              className={`transition-transform ${notesOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {notesOpen && (
            <div className="mt-3 animate-fade-in">
              <TextArea
                placeholder={t('purchase.device_notes_placeholder')}
                rows={2}
                {...register('device_notes')}
              />
            </div>
          )}
        </div>
      </div>
    </StepShell>
  );
}
