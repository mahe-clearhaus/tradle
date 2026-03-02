import React, { forwardRef, useState } from "react";
import { Autocomplete, Group, Text } from "@mantine/core";
import { flag } from "country-emoji";
import { countries, countryISOMapping } from "../domain/countries";

interface ItemProps {
  value: string;
  id: string;
}

const AutoCompleteItem = forwardRef<HTMLDivElement, ItemProps>(
  ({ id, value, ...others }: ItemProps, ref) => (
    <div ref={ref} {...others}>
      <Group noWrap>
        <Text>{flag(id)}</Text>
        <Text>{value}</Text>
      </Group>
    </div>
  )
);
AutoCompleteItem.displayName = "Lookup Autocomplete Item";

const items = countries.map((c) => ({
  value: c.name,
  id: c.code,
  oecCode: c.oecCode,
}));

export function CountryLookup() {
  const [inputValue, setInputValue] = useState("");
  const [selected, setSelected] = useState<{
    name: string;
    iframeSrc: string;
    oecLink: string;
  } | null>(null);

  const handleSelect = (item: { value: string; id: string; oecCode?: string }) => {
    const iso3 = countryISOMapping[item.id]?.toLowerCase() ?? "";
    const oecCode = item.oecCode ? item.oecCode.toLowerCase() : iso3;
    setSelected({
      name: item.value,
      iframeSrc: `https://oec.world/en/visualize/embed/tree_map/hs92/export/${oecCode}/all/show/2023/?controls=false&title=false&click=false`,
      oecLink: `https://oec.world/en/profile/country/${iso3}`,
    });
  };

  return (
    <div className="flex-grow flex flex-col mx-2 relative">
      <div className="bg-purple-50 border-l-4 border-purple-400 text-purple-700 p-2 mb-4 text-center dark:bg-purple-900 dark:text-purple-200">
        Country Lookup — search any country
      </div>
      <Autocomplete
        autoComplete="off"
        placeholder="Type a country name or code…"
        limit={7}
        itemComponent={AutoCompleteItem}
        data={items}
        filter={(value, item) =>
          item.value
            .toLowerCase()
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .includes(value.toLowerCase().trim()) ||
          item.id.toLowerCase().includes(value.toLowerCase().trim())
        }
        onItemSubmit={(item) => {
          setInputValue(item.value);
          handleSelect(item as { value: string; id: string; oecCode?: string });
        }}
        value={inputValue}
        onChange={setInputValue}
      />

      {selected ? (
        <>
          <div className="text-center my-3 text-xl font-bold">{selected.name}</div>
          <div className="relative h-0 pt-[25px] pb-96 md:pb-[70%]">
            <iframe
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
              }}
              title={`${selected.name} exports`}
              src={selected.iframeSrc}
              frameBorder="0"
            />
          </div>
          <a
            className="underline text-center block mt-3 text-sm"
            href={selected.oecLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            View {selected.name} on OEC ↗
          </a>
        </>
      ) : (
        <div className="flex-grow flex items-center justify-center text-gray-400 text-sm mt-8">
          Select a country to view its export chart
        </div>
      )}
    </div>
  );
}
