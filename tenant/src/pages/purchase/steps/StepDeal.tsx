/**
 * StepDeal — screen 2 of the 2-step purchase: the transaction. Price first
 * (the headline), then the seller. Both reuse the existing bare sections.
 */
import { useTranslation } from 'react-i18next';
import {
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';

import { StepShell } from '../Wizard';
import { type FormValues } from '../types';
import type { ExchangeRateHint } from '@/api/reports';
import Step3Seller from './Step3Seller';
import Step4Price from './Step4Price';

interface Props {
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  values: FormValues;
  errors: FieldErrors<FormValues>;
  sellerPhotos: string[];
  onSellerPhotosChange: (next: string[]) => void;
  rateHints?: ExchangeRateHint;
  priceResetKey: number;
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="px-1 text-caption font-semibold uppercase tracking-wider text-text-muted">
      {children}
    </div>
  );
}

export default function StepDeal({
  control,
  register,
  setValue,
  values,
  errors,
  sellerPhotos,
  onSellerPhotosChange,
  rateHints,
  priceResetKey,
}: Props) {
  const { t } = useTranslation();
  return (
    <StepShell
      step={1}
      title={t('purchase.step_deal_title')}
      subtitle={t('purchase.step_deal_subtitle')}
    >
      <div className="flex flex-col gap-2">
        <SectionLabel>{t('purchase.price_section')}</SectionLabel>
        <Step4Price
          control={control}
          register={register}
          setValue={setValue}
          values={values}
          errors={errors}
          rateHints={rateHints}
          priceResetKey={priceResetKey}
        />
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>{t('purchase.seller_section')}</SectionLabel>
        <Step3Seller
          control={control}
          register={register}
          setValue={setValue}
          values={values}
          errors={errors}
          sellerPhotos={sellerPhotos}
          onSellerPhotosChange={onSellerPhotosChange}
        />
      </div>
    </StepShell>
  );
}
