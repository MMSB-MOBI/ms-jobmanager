FILE=input/file.txt

echo INPUT FILE 
cat $FILE

echo "Sleeping for $sleepTime"
sleep $sleepTime

cat $FILE > file2.txt
echo "I add something" >> file2.txt
