#!/usr/bin/env python3
"""Zamienia wpisaną na sztywno liczbę stron w stopkach polis na pole NUMPAGES.

PROBLEM. Szablony InterRisk mają w stopce prawdziwe pole PAGE (numer bieżącej
strony, liczony poprawnie) i zaraz za nim ZWYKŁY TEKST z liczbą stron. Ten
tekst został wpisany, gdy dokument miał cztery strony, i został wpisany na
zawsze. Dokument urósł do ośmiu, więc stopka mówi „5/4", „8/4" i tak dalej.

Osiem z trzynastu szablonów ma tam „4", pięć ma „8" — te ostatnie zgadzają się
przez przypadek, nie z konstrukcji, i rozjadą się przy pierwszej zmianie
treści. Dlatego naprawiamy wszystkie, także te chwilowo poprawne.

ROZWIĄZANIE. W miejsce tekstu wstawiamy pole NUMPAGES, czyli ten sam mechanizm,
którym liczona jest już bieżąca strona. Od tej pory liczbę stron wylicza
program otwierający dokument, a nie osoba, która kiedyś ją wklepała.

DWA KSZTAŁTY W XML. Część szablonów trzyma „/4" w jednym przebiegu tekstu,
część rozbija na „/" i „4" osobno — dlatego nie szukamy wzorca tekstowego,
tylko idziemy od pola PAGE i zbieramy kolejne przebiegi, aż uzbiera się
„/ liczba". Wyszukiwanie po samym tekście przeoczyło dwa pliki przy pierwszym
podejściu.

FORMATOWANIE ZOSTAJE. Nowe przebiegi dziedziczą <w:rPr> z przebiegu, który
zastępują, więc czcionka, rozmiar, kolor i odstępy są te same. Stopka
InterRisk jest częścią wzoru dokumentu i nie wolno jej przy okazji przemalować.

Użycie:  python3 scripts/napraw-numeracje-stron.py [--sprawdz] [katalog]
"""
from __future__ import annotations

import re
import shutil
import sys
import zipfile
from pathlib import Path

PRZEBIEG = re.compile(r"<w:r(?:\s[^>]*)?>.*?</w:r>", re.S)
TEKST = re.compile(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>", re.S)
WLASCIWOSCI = re.compile(r"<w:rPr>.*?</w:rPr>", re.S)
CZESCI = re.compile(r"word/(?:footer|header)\d*\.xml")


def _tekst_przebiegu(xml: str) -> str:
    return "".join(TEKST.findall(xml))


def _pole_numpages(rpr: str, zapamietana: str) -> str:
    """Pole NUMPAGES w pełnym zapisie: początek, instrukcja, separator,
    zapamiętany wynik i koniec.

    Zapamiętany wynik zostaje celowo. Gdyby czytnik nie odświeżył pól, pokaże
    ostatnią znaną wartość zamiast pustego miejsca — a dokument polisy z dziurą
    w stopce wygląda na uszkodzony."""
    def r(srodek: str) -> str:
        return f"<w:r>{rpr}{srodek}</w:r>"
    return (r('<w:fldChar w:fldCharType="begin"/>')
            + r('<w:instrText xml:space="preserve"> NUMPAGES </w:instrText>')
            + r('<w:fldChar w:fldCharType="separate"/>')
            + r(f"<w:t>{zapamietana}</w:t>")
            + r('<w:fldChar w:fldCharType="end"/>'))


def napraw_xml(xml: str, stron: str) -> tuple[str, int]:
    """Zwraca (nowy xml, ile podmian). Idzie od każdego pola PAGE w prawo."""
    podmian = 0
    while True:
        przebiegi = [(m.start(), m.end(), m.group(0)) for m in PRZEBIEG.finditer(xml)]
        cel = None
        for i, (_, _, tresc) in enumerate(przebiegi):
            if "PAGE" not in tresc or "<w:instrText" not in tresc:
                continue
            # koniec pola PAGE
            koniec = next((j for j in range(i + 1, len(przebiegi))
                           if 'w:fldCharType="end"' in przebiegi[j][2]), None)
            if koniec is None:
                continue
            # zbieramy kolejne przebiegi, aż uzbiera się „/ liczba"
            zebrane, tresc_lacznie = [], ""
            for j in range(koniec + 1, min(koniec + 5, len(przebiegi))):
                if "<w:fldChar" in przebiegi[j][2] or "<w:instrText" in przebiegi[j][2]:
                    break
                zebrane.append(j)
                tresc_lacznie += _tekst_przebiegu(przebiegi[j][2])
                if re.fullmatch(r"\s*/\s*\d+\s*", tresc_lacznie):
                    cel = (zebrane, tresc_lacznie)
                    break
                if not re.fullmatch(r"\s*/?\s*\d*\s*", tresc_lacznie):
                    break        # coś innego niż numeracja - nie ruszamy
            if cel:
                break
        if not cel:
            return xml, podmian

        zebrane, _ = cel
        od, do = przebiegi[zebrane[0]][0], przebiegi[zebrane[-1]][1]
        wlasciwosci = WLASCIWOSCI.search(przebiegi[zebrane[0]][2])
        rpr = wlasciwosci.group(0) if wlasciwosci else ""
        xml = (xml[:od] + f"<w:r>{rpr}<w:t>/</w:t></w:r>"
               + _pole_numpages(rpr, stron) + xml[do:])
        podmian += 1


def wlacz_odswiezanie_pol(xml: str) -> str:
    """<w:updateFields> każe Wordowi i LibreOffice przeliczyć pola przy
    otwarciu. Bez tego dokument pokazuje zapamiętaną wartość aż do ręcznego
    odświeżenia (Ctrl+A, F9) — czyli praktycznie nigdy.

    Wstawiamy PRZED <w:compat>, bo schemat OOXML narzuca kolejność elementów
    w <w:settings> i updateFields stoi w niej wcześniej. Word wybacza drobne
    odstępstwa, ale plik polisy ma być poprawny, a nie tolerowany."""
    if "w:updateFields" in xml:
        return re.sub(r"<w:updateFields[^/>]*/>", '<w:updateFields w:val="true"/>', xml)
    znacznik = '<w:updateFields w:val="true"/>'
    for kotwica in ("<w:compat", "</w:settings>"):
        i = xml.find(kotwica)
        if i != -1:
            return xml[:i] + znacznik + xml[i:]
    return xml


def liczba_stron(z: zipfile.ZipFile) -> str:
    try:
        m = re.search(r"<Pages>(\d+)</Pages>", z.read("docProps/app.xml").decode("utf-8"))
        return m.group(1) if m else "1"
    except KeyError:
        return "1"


def napraw_plik(sciezka: Path, tylko_sprawdz: bool) -> tuple[int, str]:
    z = zipfile.ZipFile(sciezka)
    stron = liczba_stron(z)
    zawartosc = {n: z.read(n) for n in z.namelist()}
    z.close()

    podmian = 0
    for nazwa in list(zawartosc):
        if not CZESCI.fullmatch(nazwa):
            continue
        xml = zawartosc[nazwa].decode("utf-8")
        nowy, ile = napraw_xml(xml, stron)
        if ile:
            zawartosc[nazwa] = nowy.encode("utf-8")
            podmian += ile

    if podmian and not tylko_sprawdz:
        if "word/settings.xml" in zawartosc:
            zawartosc["word/settings.xml"] = wlacz_odswiezanie_pol(
                zawartosc["word/settings.xml"].decode("utf-8")).encode("utf-8")
        kopia = sciezka.with_suffix(".docx.przed-numeracja")
        if not kopia.exists():
            shutil.copy2(sciezka, kopia)
        with zipfile.ZipFile(sciezka, "w", zipfile.ZIP_DEFLATED) as nowy_zip:
            for nazwa, dane in zawartosc.items():
                nowy_zip.writestr(nazwa, dane)
    return podmian, stron


def main() -> int:
    argumenty = [a for a in sys.argv[1:] if not a.startswith("--")]
    tylko_sprawdz = "--sprawdz" in sys.argv
    katalog = Path(argumenty[0]) if argumenty else Path("templates/policies")
    pliki = sorted(p for p in katalog.glob("*.docx") if not p.name.startswith("~"))
    if not pliki:
        print(f"Brak plików .docx w {katalog}")
        return 1

    razem = 0
    for p in pliki:
        podmian, stron = napraw_plik(p, tylko_sprawdz)
        razem += podmian
        stan = "bez zmian" if not podmian else f"{podmian} stopek → NUMPAGES"
        print(f"{p.name:20} stron: {stron:>2}   {stan}")
    czasownik = "do poprawienia" if tylko_sprawdz else "poprawionych"
    print(f"\nRazem {czasownik}: {razem} stopek w {len(pliki)} szablonach")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
