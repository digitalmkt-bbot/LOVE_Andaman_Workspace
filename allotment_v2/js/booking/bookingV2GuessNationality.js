function bookingV2GuessNationality(name){
  if(!name) return '';
  const s = String(name).trim();
  if(!s) return '';
  // 1. Try learned mapping (statistical) · trained from past bookings
  const learned = natLearnGuess(s);
  if(learned) return learned;
  // 2. Fall back to static heuristics
  // Thai script
  if(/[฀-๿]/.test(s)) return 'TH';
  // CJK · Chinese characters
  if(/[一-鿿]/.test(s)) return 'CN';
  // Hangul · Korean
  if(/[가-힯]/.test(s)) return 'KR';
  // Hiragana / Katakana · Japanese
  if(/[぀-ヿ]/.test(s)) return 'JP';
  // Cyrillic · Russian default
  if(/[Ѐ-ӿ]/.test(s)) return 'RU';
  // Arabic
  if(/[؀-ۿ]/.test(s)) return 'SA';
  // Hebrew
  if(/[֐-׿]/.test(s)) return 'IL';
  // Latin · keyword heuristic on first/last name fragments
  const low = s.toLowerCase();
  const hints = [
    // Kazakh · check BEFORE Russian (shared script but distinct names)
    [/\b(aigerim|aizhan|aida|aigul|aliya|asel|gulnara|saule|dinara|madina|zhanna|kamila|raushan|symbat|tomiris|akmaral)\b/, 'KZ'],
    [/\b(bolat|yerdaulet|yerlan|nurlan|dauren|askar|aibek|baurzhan|kanat|berik|talgat|serik|ruslan|sanzhar|timur|olzhas|maxat|arman|samat|ablai|abylai)\b/, 'KZ'],
    [/\b\w*(kulov|kulova|bekov|bekova|baev|baeva|zhanov|zhanova|bayev|nazarbayev|aliyev|aliyeva|tokayev|sapiyev|ospanov|ospanova|kasymov|kasymova|abdrakhmanov|kenzhebek|nurlybek)\b/, 'KZ'],
    [/\b\w*(uly|kyzy)\b/, 'KZ'],
    // Indian
    [/\b(murali|meera|kumar|patel|singh|sharma|gupta|krishna|ravi|priya|anil|pratishruti|raj|aditya|arjun|deepak|rohit|amit|sanjay|raghav|nikhil|ananya|priyanka|sunita|kavita)\b/, 'IN'],
    // Russian
    [/\b(ivan|olga|sergey|natalia|vladimir|elena|dmitri|tatiana|yuri|svetlana|alexey|anastasia|mikhail|andrei|nikolai|pavel|maria|irina|ksenia|polina|valery|gennady|igor|denis|ekaterina)\b/, 'RU'],
    [/\b(petrov|petrova|ivanov|ivanova|smirnov|smirnova|sokolov|sokolova|kuznetsov|kuznetsova|popov|popova|volkov|volkova|fedorov|fedorova|morozov|morozova|novikov|novikova|kozlov|kozlova)\b/, 'RU'],
    // Chinese (Mandarin pinyin)
    [/\b(wei|li|zhang|wang|chen|liu|yang|huang|zhao|wu|xu|sun|zhou|hu|gao|lin|he|guo|ma|luo|song|tang|deng|han|feng|cao|peng|zeng|xiao|tian)\b/, 'CN'],
    // Korean
    [/\b(kim|park|lee|choi|jung|kang|cho|yoon|jang|lim|han|shin|seo|kwon|hwang|ahn|min|jeong|sung|hyun|jin|joon|woo|hee)\b/, 'KR'],
    // Japanese
    [/\b(yamamoto|tanaka|suzuki|sato|takahashi|nakamura|ito|watanabe|kobayashi|kato|yoshida|yamada|sasaki|matsumoto|inoue|hiroshi|yuki|sakura|takeshi|naoko|masato|akiko|kenji)\b/, 'JP'],
    // German
    [/\b(hans|wolfgang|klaus|jurgen|gunter|stefan|hannes|otto|mueller|schmidt|fischer|schneider|weber|meyer|wagner|becker|hoffmann|schulz|koch|bauer|ulrich|rainer)\b/, 'DE'],
    // French
    [/\b(pierre|jean|françois|francois|guillaume|laurent|jacques|dubois|martin|bernard|durand|moreau|lefebvre|leroy|roux|fournier|girard|bonnet|dupont|claire|sophie|amelie|julien)\b/, 'FR'],
    // Italian
    [/\b(giuseppe|luca|marco|giovanni|francesco|matteo|rossi|bianchi|romano|colombo|ricci|marino|greco|conti|moretti|barbieri|fontana|caruso|santoro|alessandro|stefano|paolo)\b/, 'IT'],
    // Spanish
    [/\b(juan|carlos|pedro|jose|miguel|garcia|rodriguez|lopez|martinez|gonzalez|hernandez|fernandez|gomez|ruiz|jimenez|alvarez|moreno|munoz|romero|alonso|gutierrez)\b/, 'ES'],
    // British / American common surnames
    [/\b(smith|johnson|williams|brown|jones|miller|davis|wilson|anderson|taylor|thomas|jackson|harris|clark|lewis|walker|robinson|hall|young|king|wright|hill|scott|green|adams)\b/, 'GB'],
    // Thai (latin)
    [/\b(somchai|niran|ploy|nong|som|krit|preecha|chaiwat|wanida|chai|nuan|noi|lek|prayut|thanaporn|natthaphon|kanya|sopida|wachira|piyaporn)\b/, 'TH'],
    // Australian common (mostly British roots · keep as AU when "aussie" markers present)
    [/\b(macquarie|murray|kelly|oconnor|brennan|sullivan|mcdonald|mccarthy|murphy|ryan|nguyen)\b/, 'AU'],
    // Dutch
    [/\b(jan|piet|hendrik|willem|van der|de jong|van den|de vries|bakker|janssen|visser|smit|meijer|de boer|mulder|jansen)\b/, 'NL']
  ];
  for(const [re, code] of hints){ if(re.test(low)) return code; }
  // Last-resort suffix heuristic (very weak): -ova/-ovich → CIS region, default RU
  if(/\b\w+ov(a|ich|na)?\b/.test(low)) return 'RU';
  return '';
}
